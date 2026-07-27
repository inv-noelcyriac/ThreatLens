# import gc
# import json
# import logging
# import os
# import subprocess
# from datetime import datetime
# from pathlib import Path

# from django.conf import settings
# from django.db import reset_queries
# from django.utils import timezone

# from ingestion.models import SourceAdvisory
# from ingestion.tasks import BaseIngestionTask

# logger = logging.getLogger("ingestion_logger")

# BATCH_SIZE = 1000


# def parse_iso_datetime(dt_str: str):
#     """Parses an ISO 8601 date string (e.g. 2026-07-22T08:54:28Z) into a UTC datetime object."""
#     if not dt_str:
#         return None
#     try:
#         clean_str = dt_str.rstrip("Z")
#         dt = datetime.fromisoformat(clean_str)
#         return timezone.make_aware(dt) if timezone.is_naive(dt) else dt
#     except Exception:
#         return None


# class GHSAGitTask(BaseIngestionTask):
#     """
#     Production GHSA Git Ingestion Worker.
#     Memory-safe, lightweight output, supports incremental delta runs via SyncState checkpoints.
#     """

#     source_name = "ghsa"
#     required_keys = ["id", "modified"]

#     REPO_URL = os.environ.get("GHSA_REPO_URL")
#     DEFAULT_REPO_PATH = str(Path(settings.BASE_DIR) / "data" / "ghsa_repo")
#     LOCAL_REPO_DIR = os.environ.get("GHSA_REPO_DIR", DEFAULT_REPO_PATH)

#     def sync_repository(self) -> Path:
#         repo_path = Path(self.LOCAL_REPO_DIR)
#         if not repo_path.exists():
#             logger.info(f"[GHSA] Cloning repository from {self.REPO_URL}...")
#             subprocess.run(
#                 ["git", "clone", "--depth", "1", self.REPO_URL, str(repo_path)],
#                 check=True,
#             )
#         else:
#             logger.info("[GHSA] Repository exists. Pulling latest commit...")
#             subprocess.run(["git", "-C", str(repo_path), "pull"], check=True)
#         return repo_path

#     def run(self) -> None:
#         logger.info("[GHSA] Starting GHSA Git ingestion worker...")

#         # 1. Fetch latest successful baseline timestamp checkpoint
#         last_checkpoint = self.get_last_checkpoint()

#         # 2. Create the SINGLE tracking row in RUNNING state
#         sync_record = self.record_start(last_checkpoint=last_checkpoint)

#         if not self.REPO_URL:
#             error_msg = "GHSA_REPO_URL environment variable is missing."
#             logger.error(f"[GHSA] {error_msg}")
#             # Mutate active row to FAILED
#             self.record_failure(sync_record=sync_record, error_message=error_msg)
#             return

#         if last_checkpoint:
#             logger.info(
#                 f"[GHSA] Incremental sync baseline checkpoint: {last_checkpoint}"
#             )
#         else:
#             logger.info("[GHSA] No previous checkpoint found. Performing full sync.")

#         total_scanned = 0
#         total_processed = 0
#         batch_buffer = []
#         newest_item_timestamp = last_checkpoint

#         try:
#             # 3. Pull/Sync git repository
#             repo_path = self.sync_repository()

#             logger.info("[GHSA] Traversing repository files...")

#             for json_file in repo_path.glob("**/*.json"):
#                 if json_file.name in ["package.json", "package-lock.json"]:
#                     continue

#                 total_scanned += 1
#                 ghsa_id = json_file.stem

#                 try:
#                     with open(json_file, "r", encoding="utf-8") as f:
#                         payload = json.load(f)
#                 except Exception as read_err:
#                     logger.error(f"[GHSA] Failed to read {json_file.name}: {read_err}")
#                     continue

#                 external_id = payload.get("id") or ghsa_id

#                 # Safe Schema Check
#                 missing = set(self.required_keys) - set(payload.keys())
#                 if missing:
#                     logger.warning(
#                         f"[GHSA] Schema warning [{external_id}]: Missing keys {missing}"
#                     )
#                     continue

#                 # Parse modified/published timestamp for incremental filtering
#                 mod_str = payload.get("modified") or payload.get("published")
#                 item_dt = parse_iso_datetime(mod_str)

#                 # INCREMENTAL FILTERING CHECK: Skip records older than or equal to checkpoint
#                 if last_checkpoint and item_dt and item_dt <= last_checkpoint:
#                     continue

#                 batch_buffer.append(
#                     SourceAdvisory(
#                         external_id=external_id,
#                         source=self.source_name,
#                         raw_payload=payload,
#                     )
#                 )

#                 # Track running highest timestamp
#                 if item_dt and (
#                     newest_item_timestamp is None or item_dt > newest_item_timestamp
#                 ):
#                     newest_item_timestamp = item_dt

#                 # Flush batch every 1,000 records
#                 if len(batch_buffer) >= BATCH_SIZE:
#                     SourceAdvisory.objects.bulk_create(
#                         batch_buffer, ignore_conflicts=True
#                     )
#                     total_processed += len(batch_buffer)
#                     logger.info(
#                         f"[GHSA] Bulk-saved batch of {len(batch_buffer)} items | Scanned: {total_scanned:,}"
#                     )

#                     batch_buffer.clear()
#                     reset_queries()
#                     gc.collect()

#             # Flush final remaining items
#             if batch_buffer:
#                 SourceAdvisory.objects.bulk_create(batch_buffer, ignore_conflicts=True)
#                 total_processed += len(batch_buffer)
#                 logger.info(f"[GHSA] Final batch saved ({len(batch_buffer)} items).")
#                 batch_buffer.clear()

#             reset_queries()
#             gc.collect()

#             final_sync_time = (
#                 newest_item_timestamp or last_checkpoint or timezone.now()
#             )

#             # 4. Mutate active row to SUCCESS
#             self.record_success(
#                 sync_record=sync_record,
#                 records_processed=total_processed,
#                 sync_time=final_sync_time,
#             )

#             logger.info(
#                 f"[GHSA] Finished successfully! Scanned: {total_scanned:,} | "
#                 f"Processed: {total_processed:,} | New Checkpoint: {final_sync_time}"
#             )

#         except Exception as e:
#             error_trace = f"PIPELINE CRASHED: {str(e)}"
#             logger.error(f"[GHSA] {error_trace}")
#             # Mutate active row to FAILED
#             self.record_failure(sync_record=sync_record, error_message=error_trace)

import gc
import json
import logging
import os
import subprocess
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.db import reset_queries
from django.utils import timezone

from ingestion.models import SourceAdvisory
from ingestion.tasks import BaseIngestionTask

logger = logging.getLogger("ingestion_logger")

BATCH_SIZE = 1000

# Strict year boundary filter configuration
MIN_ALLOWED_YEAR = 2025
MAX_ALLOWED_YEAR = 2026


def parse_iso_datetime(dt_str: str):
    """Parses an ISO 8601 date string (e.g. 2026-07-22T08:54:28Z) into a UTC datetime object."""
    if not dt_str:
        return None
    try:
        clean_str = dt_str.rstrip("Z")
        dt = datetime.fromisoformat(clean_str)
        return timezone.make_aware(dt) if timezone.is_naive(dt) else dt
    except Exception:
        return None


def extract_year_from_payload(payload: dict) -> int | None:
    """Helper to extract publication or modification year from GHSA JSON payload."""
    date_str = (
        payload.get("published")
        or payload.get("published_at")
        or payload.get("modified")
        or payload.get("updated_at")
    )
    if date_str and len(date_str) >= 4 and date_str[:4].isdigit():
        return int(date_str[:4])
    
    dt = parse_iso_datetime(date_str)
    return dt.year if dt else None


class GHSAGitTask(BaseIngestionTask):
    """
    Production GHSA Git Ingestion Worker.
    Memory-safe, lightweight output, restricted strictly to 2025-2026 advisories.
    """

    source_name = "ghsa"
    required_keys = ["id", "modified"]

    REPO_URL = os.environ.get("GHSA_REPO_URL")
    DEFAULT_REPO_PATH = str(Path(settings.BASE_DIR) / "data" / "ghsa_repo")
    LOCAL_REPO_DIR = os.environ.get("GHSA_REPO_DIR", DEFAULT_REPO_PATH)

    def sync_repository(self) -> Path:
        repo_path = Path(self.LOCAL_REPO_DIR)
        if not repo_path.exists():
            logger.info(f"[GHSA] Cloning repository from {self.REPO_URL}...")
            subprocess.run(
                ["git", "clone", "--depth", "1", self.REPO_URL, str(repo_path)],
                check=True,
            )
        else:
            logger.info("[GHSA] Repository exists. Pulling latest commit...")
            subprocess.run(["git", "-C", str(repo_path), "pull"], check=True)
        return repo_path

    def run(self) -> None:
        logger.info("[GHSA] Starting GHSA Git ingestion worker (Target Years: 2025-2026)...")

        # 1. Fetch latest successful baseline timestamp checkpoint
        last_checkpoint = self.get_last_checkpoint()

        # 2. Create the SINGLE tracking row in RUNNING state
        sync_record = self.record_start(last_checkpoint=last_checkpoint)

        if not self.REPO_URL:
            error_msg = "GHSA_REPO_URL environment variable is missing."
            logger.error(f"[GHSA] {error_msg}")
            self.record_failure(sync_record=sync_record, error_message=error_msg)
            return

        if last_checkpoint:
            logger.info(
                f"[GHSA] Incremental sync baseline checkpoint: {last_checkpoint}"
            )
        else:
            logger.info("[GHSA] No previous checkpoint found. Performing full sync for 2025-2026.")

        total_scanned = 0
        total_processed = 0
        batch_buffer = []
        newest_item_timestamp = last_checkpoint

        try:
            # 3. Pull/Sync git repository
            repo_path = self.sync_repository()

            logger.info("[GHSA] Traversing repository files...")

            for json_file in repo_path.glob("**/*.json"):
                if json_file.name in ["package.json", "package-lock.json"]:
                    continue

                total_scanned += 1
                ghsa_id = json_file.stem

                try:
                    with open(json_file, "r", encoding="utf-8") as f:
                        payload = json.load(f)
                except Exception as read_err:
                    logger.error(f"[GHSA] Failed to read {json_file.name}: {read_err}")
                    continue

                external_id = payload.get("id") or ghsa_id

                # Safe Schema Check
                missing = set(self.required_keys) - set(payload.keys())
                if missing:
                    logger.warning(
                        f"[GHSA] Schema warning [{external_id}]: Missing keys {missing}"
                    )
                    continue

                # -------------------------------------------------------------
                # STRICT YEAR BOUNDARY CHECK (2025 - 2026 ONLY)
                # -------------------------------------------------------------
                item_year = extract_year_from_payload(payload)
                if not item_year or not (MIN_ALLOWED_YEAR <= item_year <= MAX_ALLOWED_YEAR):
                    continue

                # Parse modified/published timestamp for incremental filtering
                mod_str = payload.get("modified") or payload.get("published")
                item_dt = parse_iso_datetime(mod_str)

                # INCREMENTAL FILTERING CHECK: Skip records older than or equal to checkpoint
                if last_checkpoint and item_dt and item_dt <= last_checkpoint:
                    continue

                batch_buffer.append(
                    SourceAdvisory(
                        external_id=external_id,
                        source=self.source_name,
                        raw_payload=payload,
                    )
                )

                # Track running highest timestamp
                if item_dt and (
                    newest_item_timestamp is None or item_dt > newest_item_timestamp
                ):
                    newest_item_timestamp = item_dt

                # Flush batch every 1,000 records
                if len(batch_buffer) >= BATCH_SIZE:
                    SourceAdvisory.objects.bulk_create(
                        batch_buffer, ignore_conflicts=True
                    )
                    total_processed += len(batch_buffer)
                    logger.info(
                        f"[GHSA] Bulk-saved batch of {len(batch_buffer)} items | Scanned: {total_scanned:,}"
                    )

                    batch_buffer.clear()
                    reset_queries()
                    gc.collect()

            # Flush final remaining items
            if batch_buffer:
                SourceAdvisory.objects.bulk_create(batch_buffer, ignore_conflicts=True)
                total_processed += len(batch_buffer)
                logger.info(f"[GHSA] Final batch saved ({len(batch_buffer)} items).")
                batch_buffer.clear()

            reset_queries()
            gc.collect()

            final_sync_time = (
                newest_item_timestamp or last_checkpoint or timezone.now()
            )

            # 4. Mutate active row to SUCCESS
            self.record_success(
                sync_record=sync_record,
                records_processed=total_processed,
                sync_time=final_sync_time,
            )

            logger.info(
                f"[GHSA] Finished successfully! Scanned: {total_scanned:,} | "
                f"Processed: {total_processed:,} | New Checkpoint: {final_sync_time}"
            )

        except Exception as e:
            error_trace = f"PIPELINE CRASHED: {str(e)}"
            logger.error(f"[GHSA] {error_trace}")
            # Mutate active row to FAILED
            self.record_failure(sync_record=sync_record, error_message=error_trace)