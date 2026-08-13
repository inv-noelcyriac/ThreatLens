import gc
import json
import logging
import os
import tempfile
import zipfile
from datetime import datetime

from django.db import reset_queries
from django.utils import timezone

from ingestion.models import SourceAdvisory
from ingestion.tasks import BaseIngestionTask

logger = logging.getLogger("ingestion_logger")

OSV_BASE_URL = os.environ.get("OSV_URL")

BATCH_SIZE = 1000

# Strict year boundary filter configuration
MIN_ALLOWED_YEAR = 2025
MAX_ALLOWED_YEAR = 2026


def parse_iso_datetime(dt_str: str):
    """Parses ISO 8601 string into an aware UTC datetime."""
    if not dt_str:
        return None
    try:
        clean_str = dt_str.rstrip("Z")
        dt = datetime.fromisoformat(clean_str)
        return timezone.make_aware(dt) if timezone.is_naive(dt) else dt
    except Exception:
        return None


def extract_year_from_payload(payload: dict) -> int | None:
    """Helper to extract publication or modification year from OSV JSON payload."""
    date_str = (
        payload.get("published")
        or payload.get("modified")
        or payload.get("withdrawn")
    )
    if date_str and len(date_str) >= 4 and date_str[:4].isdigit():
        return int(date_str[:4])
    
    dt = parse_iso_datetime(date_str)
    return dt.year if dt else None


class OSVZipIngestionTask(BaseIngestionTask):
    """
    Production OSV Ingestion Worker.
    - Full Sync: Direct baseline bulk insertion from all.zip on cold start.
    - Incremental Sync: Streams modified_id.csv to fetch ONLY modified records with upsert/re-normalization triggers.
    - Target Years: Restricted strictly to 2025-2026 advisories.
    """

    source_name = "osv"
    required_keys = ["id", "modified"]

    def run_full_sync(self) -> tuple[int, datetime]:
        """Downloads full all.zip and performs complete initial baseline import."""
        logger.info(
            "[OSV] Initializing Full Baseline Sync via all.zip snapshot (Target Years: 2025-2026)..."
        )
        zip_url = os.getenv("OSV_URL") or f"{OSV_BASE_URL}/all.zip"

        total_processed = 0
        newest_item_timestamp = None
        batch_buffer = []

        with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp_file:
            tmp_path = tmp_file.name
            try:
                response = self.fetch_with_retry(
                    target_url=zip_url, stream=True
                )
                for chunk in response.iter_content(chunk_size=128 * 1024):
                    if chunk:
                        tmp_file.write(chunk)
                tmp_file.flush()

                with zipfile.ZipFile(tmp_path, "r") as archive:
                    json_files = [
                        name
                        for name in archive.namelist()
                        if name.endswith(".json")
                    ]
                    total_files = len(json_files)

                    for index, file_name in enumerate(json_files, start=1):
                        try:
                            with archive.open(file_name) as json_file:
                                advisory = json.load(json_file)

                            external_id = advisory.get("id")
                            if not external_id:
                                continue

                            # Year boundary check (2025-2026 only)
                            item_year = extract_year_from_payload(advisory)
                            if not item_year or not (MIN_ALLOWED_YEAR <= item_year <= MAX_ALLOWED_YEAR):
                                continue

                            item_dt = parse_iso_datetime(
                                advisory.get("modified") or advisory.get("published")
                            )

                            batch_buffer.append(
                                SourceAdvisory(
                                    external_id=external_id,
                                    source=self.source_name,
                                    raw_payload=advisory,
                                )
                            )

                            if item_dt and (
                                newest_item_timestamp is None
                                or item_dt > newest_item_timestamp
                            ):
                                newest_item_timestamp = item_dt

                            # Direct high-speed bulk create for initial baseline run
                            if len(batch_buffer) >= BATCH_SIZE:
                                now = timezone.now()
                                for item in batch_buffer:
                                    item.fetched_at = now
                                SourceAdvisory.objects.bulk_create(
                                    batch_buffer,
                                    ignore_conflicts=True,
                                )
                                total_processed += len(batch_buffer)
                                logger.info(
                                    f"[OSV] Full Sync progress: {total_processed} advisories inserted (Scanned {index}/{total_files})."
                                )
                                batch_buffer.clear()
                                reset_queries()
                                gc.collect()

                        except (json.JSONDecodeError, TypeError) as err:
                            logger.error(
                                f"[OSV] Error reading {file_name}: {err}"
                            )

                    # Flush final baseline batch
                    if batch_buffer:
                        now = timezone.now()
                        for item in batch_buffer:
                            item.fetched_at = now
                        SourceAdvisory.objects.bulk_create(
                            batch_buffer,
                            ignore_conflicts=True,
                        )
                        total_processed += len(batch_buffer)
                        logger.info(f"[OSV] Full Sync final batch saved ({len(batch_buffer)} items).")
                        batch_buffer.clear()
                        reset_queries()
                        gc.collect()

                return total_processed, newest_item_timestamp

            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)

    def run_incremental_sync(
        self, last_checkpoint: datetime, max_batch: int = 500
    ) -> tuple[int, datetime]:
        """Streams modified_id.csv, fetches updated records, and sets normalized_at = None."""
        logger.info(
            f"[OSV] Starting Incremental Sync (Checkpoint: {last_checkpoint})..."
        )
        csv_url = f"{OSV_BASE_URL}/modified_id.csv"

        raw_csv = self.fetch_with_retry(target_url=csv_url)
        lines = raw_csv.splitlines()

        total_processed = 0
        newest_item_timestamp = last_checkpoint
        batch_buffer = []

        for line in lines:
            if not line.strip():
                continue

            parts = line.split(",", 1)
            if len(parts) != 2:
                continue

            mod_str, relative_path = parts[0].strip(), parts[1].strip()
            item_dt = parse_iso_datetime(mod_str)

            # 1. Stop when hitting records older than or equal to checkpoint
            if item_dt and item_dt <= last_checkpoint:
                logger.info(
                    f"[OSV] Reached record modified at {item_dt} <= checkpoint ({last_checkpoint}). Stopping CSV stream."
                )
                break

            # 2. Safety Batch Threshold
            if total_processed + len(batch_buffer) >= max_batch:
                logger.info(
                    f"[OSV] Reached safety batch threshold ({max_batch} records). Stopping run cycle."
                )
                break

            item_url = f"{OSV_BASE_URL}/{relative_path}.json"
            try:
                item_text = self.fetch_with_retry(target_url=item_url)
                advisory = json.loads(item_text)
                external_id = advisory.get("id") or relative_path.split("/")[-1]

                # Year boundary check
                item_year = extract_year_from_payload(advisory)
                if not item_year or not (MIN_ALLOWED_YEAR <= item_year <= MAX_ALLOWED_YEAR):
                    continue

                batch_buffer.append(
                    SourceAdvisory(
                        external_id=external_id,
                        source=self.source_name,
                        raw_payload=advisory,
                    )
                )

                if item_dt and (
                    newest_item_timestamp is None
                    or item_dt > newest_item_timestamp
                ):
                    newest_item_timestamp = item_dt

            except Exception as err:
                logger.error(
                    f"[OSV] Failed to fetch modified item {relative_path}: {err}"
                )

        # Upsert incremental batch and trigger re-normalization
        if batch_buffer:
            now = timezone.now()
            for item in batch_buffer:
                item.normalized_at = None
                item.fetched_at = now

            SourceAdvisory.objects.bulk_create(
                batch_buffer,
                update_conflicts=True,
                unique_fields=["external_id", "source"],
                update_fields=["raw_payload", "normalized_at", "fetched_at"],
            )
            total_processed += len(batch_buffer)
            logger.info(f"[OSV] Incremental sync upserted batch of {len(batch_buffer)} items.")
            batch_buffer.clear()
            reset_queries()
            gc.collect()

        return total_processed, newest_item_timestamp

    def run(self) -> None:
        logger.info("[OSV] Starting OSV Ingestion Task...")

        # 1. Fetch latest successful baseline timestamp checkpoint
        last_checkpoint = self.get_last_checkpoint()

        # 2. Create single tracking row in RUNNING state
        sync_record = self.record_start(last_checkpoint=last_checkpoint)

        try:
            if not last_checkpoint:
                total_processed, newest_ts = self.run_full_sync()
            else:
                total_processed, newest_ts = (
                    self.run_incremental_sync(last_checkpoint)
                )

            final_sync_time = newest_ts or last_checkpoint or timezone.now()

            # 3. Mutate active row to SUCCESS
            self.record_success(
                sync_record=sync_record,
                records_processed=total_processed,
                sync_time=final_sync_time,
            )

            logger.info(
                f"[OSV] Sync completed successfully! "
                f"Records Processed: {total_processed} | New Checkpoint: {final_sync_time}"
            )

        except Exception as e:
            error_trace = f"Pipeline execution failed: {str(e)}"
            logger.critical(f"[OSV] {error_trace}")

            # Mutate active row to FAILED
            self.record_failure(
                sync_record=sync_record,
                error_message=error_trace,
            )
            raise