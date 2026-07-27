import json
import logging
import os
import time
from datetime import datetime

from django.utils import timezone

from ingestion.tasks import BaseIngestionTask

logger = logging.getLogger("ingestion_logger")

# ==========================================================
# Docker ecosystem identifiers.
# ==========================================================
DOCKER_ECOSYSTEM_CPES = [
    ("docker", "cpe:2.3:a:docker:docker"),
    ("docker_engine", "cpe:2.3:a:docker:engine"),
    ("moby", "cpe:2.3:a:mobyproject:moby"),
    ("containerd", "cpe:2.3:a:containerd:containerd"),
    ("runc", "cpe:2.3:a:opencontainers:runc"),
    ("buildkit", "cpe:2.3:a:mobyproject:buildkit"),
]


def parse_iso_datetime(dt_str: str):
    """Utility to parse ISO 8601 string (e.g. 2026-07-23T05:13:20Z) into a timezone-aware datetime."""
    if not dt_str:
        return None
    try:
        clean_str = dt_str.rstrip("Z")
        dt = datetime.fromisoformat(clean_str)
        return timezone.make_aware(dt) if timezone.is_naive(dt) else dt
    except Exception:
        return None


class DockerHardenedOSVTask(BaseIngestionTask):
    """
    [STREAM 1] Production worker tracking container base OS packages.
    Pulls live index and advisory files directly from the GitHub repository.
    Supports incremental delta syncs via SyncState checkpoints.
    """

    source_name: str = "docker_hardened_osv"
    required_keys = ["id", "modified", "schema_version", "details"]

    def run(self) -> None:
        logger.info(
            f"[{self.source_name.upper()}] Initializing production index task..."
        )

        # 1. Fetch latest successful baseline timestamp checkpoint
        last_checkpoint = self.get_last_checkpoint()

        # 2. Create single tracking row in RUNNING state
        sync_record = self.record_start(last_checkpoint=last_checkpoint)

        target_url = os.environ.get("DOCKER_TARGET_URL")
        if not target_url:
            error_msg = "DOCKER_TARGET_URL environment variable is missing."
            logger.error(f"[{self.source_name.upper()}] {error_msg}")
            self.record_failure(sync_record=sync_record, error_message=error_msg)
            return

        if last_checkpoint:
            logger.info(
                f"[{self.source_name.upper()}] Incremental sync baseline checkpoint: {last_checkpoint}"
            )
        else:
            logger.info(
                f"[{self.source_name.upper()}] No previous checkpoint found. Performing full sync."
            )

        records_processed = 0
        newest_item_timestamp = last_checkpoint

        try:
            # 3. Fetch the live index file over the network
            index_raw = self.fetch_with_retry(target_url=target_url)
            if not index_raw:
                error_msg = "Index payload is empty or None."
                logger.error(f"[{self.source_name.upper()}] {error_msg}")
                self.record_failure(sync_record=sync_record, error_message=error_msg)
                return

            index_data = json.loads(index_raw)
            advisory_files = index_data.get("advisories", [])
            logger.info(
                f"[{self.source_name.upper()}] Discovered {len(advisory_files)} live vulnerability targets."
            )

            base_url = os.environ.get("DOCKER_BASE_URL", "")

            for file_name in advisory_files:
                file_url = f"{base_url}{file_name}"

                try:
                    logger.info(
                        f"[{self.source_name.upper()}] Fetching live target file: {file_name}"
                    )
                    raw_osv_payload = self.fetch_with_retry(target_url=file_url)
                    if not raw_osv_payload:
                        logger.error(
                            f"[{self.source_name.upper()}] Target payload is empty or None for file {file_name}."
                        )
                        continue

                    osv_dict = json.loads(raw_osv_payload)
                    external_id = osv_dict.get("id", "").strip()
                    if not external_id:
                        continue

                    # Parse modified/published timestamp
                    mod_str = osv_dict.get("modified") or osv_dict.get("published")
                    item_dt = parse_iso_datetime(mod_str)

                    # INCREMENTAL FILTERING CHECK: Skip items older than or equal to checkpoint
                    if last_checkpoint and item_dt and item_dt <= last_checkpoint:
                        continue

                    self.save_advisory(
                        external_id=external_id, raw_payload=osv_dict
                    )
                    records_processed += 1

                    # Track newest record timestamp
                    if item_dt and (
                        newest_item_timestamp is None
                        or item_dt > newest_item_timestamp
                    ):
                        newest_item_timestamp = item_dt

                except Exception as inner_error:
                    logger.error(
                        f"[{self.source_name.upper()}] Error scraping deep file '{file_name}': {str(inner_error)}"
                    )
                    continue

            final_sync_time = (
                newest_item_timestamp or last_checkpoint or timezone.now()
            )

            # 4. Mutate active row to SUCCESS
            self.record_success(
                sync_record=sync_record,
                records_processed=records_processed,
                sync_time=final_sync_time,
            )

            logger.info(
                f"[{self.source_name.upper()}] Live index processing completed cleanly. "
                f"Processed {records_processed} new records. New checkpoint: {final_sync_time}"
            )

        except Exception as e:
            error_trace = f"PIPELINE CRASHED: {str(e)}"
            logger.error(f"[{self.source_name.upper()}] {error_trace}")
            self.record_failure(sync_record=sync_record, error_message=error_trace)


class DockerEcosystemTask(BaseIngestionTask):
    """
    Fetches Docker ecosystem vulnerabilities from NVD using incremental delta syncs.
    """

    source_name: str = "docker_ecosystem"
    CPE_IDENTIFIERS = DOCKER_ECOSYSTEM_CPES

    def run(self) -> None:
        logger.info(
            f"[{self.source_name.upper()}] Starting Docker ecosystem ingestion task..."
        )

        # 1. Fetch latest successful baseline timestamp checkpoint
        last_checkpoint = self.get_last_checkpoint()

        # 2. Create single tracking row in RUNNING state
        sync_record = self.record_start(last_checkpoint=last_checkpoint)

        base_url = os.environ.get("DOCKER_ECOSYSTEM_BASE_URL")
        if not base_url:
            error_msg = "DOCKER_ECOSYSTEM_BASE_URL environment variable is missing."
            logger.error(f"[{self.source_name.upper()}] {error_msg}")
            self.record_failure(sync_record=sync_record, error_message=error_msg)
            return

        try:
            env_results_per_page = int(
                os.environ.get("DOCKER_RESULTS_PER_PAGE", "1000")
            )
        except ValueError:
            env_results_per_page = 1000
        results_per_page = min(env_results_per_page, 1000)

        try:
            rate_limit_delay = float(
                os.environ.get("DOCKER_RATE_LIMIT_DELAY", "6.0")
            )
        except ValueError:
            rate_limit_delay = 6.0

        total_saved = 0
        run_start_time = timezone.now()

        try:
            for identifier_name, cpe in self.CPE_IDENTIFIERS:
                logger.info(
                    f"[{self.source_name.upper()}] Processing [{identifier_name}]"
                )
                start_index = 0

                while True:
                    params = {
                        "virtualMatchString": cpe,
                        "startIndex": start_index,
                        "resultsPerPage": results_per_page,
                    }

                    # NVD INCREMENTAL DELTA QUERY: Pass lastModStartDate and lastModEndDate if checkpoint exists
                    if last_checkpoint:
                        params["lastModStartDate"] = last_checkpoint.strftime(
                            "%Y-%m-%dT%H:%M:%S.000"
                        )
                        params["lastModEndDate"] = run_start_time.strftime(
                            "%Y-%m-%dT%H:%M:%S.000"
                        )

                    try:
                        raw_text = self.fetch_with_retry(
                            target_url=base_url, params=params
                        )
                        if not raw_text:
                            break

                        response = json.loads(raw_text)
                        vulnerabilities = response.get("vulnerabilities", [])
                        total_results = response.get("totalResults", 0)

                        logger.info(
                            f"[{identifier_name}] "
                            f"Fetched {len(vulnerabilities)} "
                            f"({min(start_index + len(vulnerabilities), total_results)}/{total_results})"
                        )

                        if not vulnerabilities:
                            break

                        for item in vulnerabilities:
                            cve = item.get("cve", {})
                            cve_id = cve.get("id", "").strip()

                            if not cve_id:
                                continue

                            self.save_advisory(
                                external_id=cve_id, raw_payload=item
                            )
                            total_saved += 1

                        start_index += results_per_page

                        if start_index >= total_results:
                            break

                        time.sleep(rate_limit_delay)

                    except Exception as err:
                        logger.exception(
                            f"[{identifier_name}] Ingestion batch failed: {err}"
                        )
                        break

            final_sync_time = (
                run_start_time
                if total_saved > 0
                else (last_checkpoint or run_start_time)
            )

            # 3. Mutate active row to SUCCESS
            self.record_success(
                sync_record=sync_record,
                records_processed=total_saved,
                sync_time=final_sync_time,
            )

            logger.info(
                f"[{self.source_name.upper()}] Completed successfully. "
                f"Total advisories processed: {total_saved} | New Checkpoint: {final_sync_time}"
            )

        except Exception as e:
            error_trace = f"PIPELINE CRASHED: {str(e)}"
            logger.error(f"[{self.source_name.upper()}] {error_trace}")
            self.record_failure(sync_record=sync_record, error_message=error_trace)