import gc
import json
import logging
import os
import time

from django.db import reset_queries, transaction
from django.utils import timezone

from ingestion.models import SourceAdvisory
from ingestion.tasks import BaseIngestionTask

logger = logging.getLogger("ingestion_logger")

RESULTS_PER_PAGE = 1000
API_DELAY_WITH_KEY = 0.6
API_DELAY_WITHOUT_KEY = 6.0


class NVDApiTask(BaseIngestionTask):
    source_name = "nvd"

    required_keys = [
        "id",
        "sourceIdentifier",
        "vulnStatus",
    ]

    # Hardcoded fallback to official NIST NVD API 2.0 endpoint
    DEFAULT_API_URL = os.environ.get("NVD_API_URL")

    def validate_schema(self, external_id: str, payload_dict: dict) -> bool:
        cve_block = payload_dict.get("cve", {})
        return super().validate_schema(external_id, cve_block)

    def run(self, start_index: int = None) -> None:
        logger.info("[NVD] Starting optimized NVD ingestion worker...")

        # 1. Fetch latest successful baseline timestamp checkpoint
        last_checkpoint = self.get_last_checkpoint()
        run_start_time = timezone.now()

        # 2. Create single tracking row in RUNNING state
        sync_record = self.record_start(last_checkpoint=last_checkpoint)

        api_url = os.environ.get("NVD_API_URL") or self.DEFAULT_API_URL
        if not api_url:
            error_msg = "NVD_API_URL environment variable is missing."
            logger.error(f"[NVD] {error_msg}")
            # Mutate active row to FAILED
            self.record_failure(sync_record=sync_record, error_message=error_msg)
            return

        api_key = os.environ.get("NVD_API_KEY")
        headers = {}

        if api_key:
            headers["apiKey"] = api_key
            delay = API_DELAY_WITH_KEY
            logger.info("[NVD] API key detected. Performance rate-limiting enabled.")
        else:
            delay = API_DELAY_WITHOUT_KEY
            logger.warning(
                "[NVD] Running without API key. Reduced request rate enforced."
            )

        # Calculate start_index / resume logic depending on sync mode
        if last_checkpoint:
            logger.info(
                f"[NVD] Incremental sync baseline checkpoint: {last_checkpoint}"
            )
            if start_index is None:
                start_index = 0
        else:
            logger.info("[NVD] No previous checkpoint found. Performing full sync.")
            if start_index is None:
                existing_count = SourceAdvisory.objects.filter(
                    source=self.source_name
                ).count()
                start_index = (
                    existing_count // RESULTS_PER_PAGE
                ) * RESULTS_PER_PAGE
                logger.info(
                    f"[NVD] Auto-resume checkpoint calculated: Resuming at index {start_index} "
                    f"(DB already holds {existing_count} saved records)."
                )

        total_processed = 0

        try:
            while True:
                params = {
                    "startIndex": start_index,
                    "resultsPerPage": RESULTS_PER_PAGE,
                }

                # Attach ISO date range filter if running incrementally
                if last_checkpoint:
                    params["lastModStartDate"] = last_checkpoint.strftime(
                        "%Y-%m-%dT%H:%M:%S.000"
                    )
                    params["lastModEndDate"] = run_start_time.strftime(
                        "%Y-%m-%dT%H:%M:%S.000"
                    )

                logger.info(
                    f"[NVD] Fetching batch starting at index {start_index}"
                )

                raw_text = self.fetch_with_retry(
                    target_url=api_url,
                    headers=headers,
                    params=params,
                )

                # Validate string content before JSON parsing
                if not raw_text:
                    raise ValueError(
                        f"Empty or null payload received from NVD endpoint at index {start_index}"
                    )

                try:
                    data = json.loads(raw_text)
                except (json.JSONDecodeError, TypeError) as parse_error:
                    logger.error(
                        f"[NVD] Malformed payload received at index {start_index}. Error: {parse_error}"
                    )
                    raise

                vulnerabilities = data.get("vulnerabilities", [])

                if not vulnerabilities:
                    logger.info(
                        "[NVD] Empty vulnerability list returned. Feed processing completed."
                    )
                    break

                total_results = data.get("totalResults", 0)

                logger.info(
                    f"[NVD] Retrieved {len(vulnerabilities)} records "
                    f"({start_index}/{total_results})"
                )

                # Batch preparation
                advisories_to_create = []
                for item in vulnerabilities:
                    cve = item.get("cve", {})
                    external_id = cve.get("id")

                    if not external_id:
                        continue

                    if self.validate_schema(external_id, item):
                        advisories_to_create.append(
                            SourceAdvisory(
                                external_id=external_id,
                                source=self.source_name,
                                raw_payload=item,
                            )
                        )

                # # Single bulk DB transaction
                # if advisories_to_create:
                #     SourceAdvisory.objects.bulk_create(
                #         advisories_to_create, ignore_conflicts=True
                #     )
                #     total_processed += len(advisories_to_create)

                if advisories_to_create:
                    now = timezone.now()
                    # Ensure every advisory object in this batch has normalized_at set to None and fetched_at set to current timestamp
                    for advisory in advisories_to_create:
                        advisory.normalized_at = None
                        advisory.fetched_at = now

                    SourceAdvisory.objects.bulk_create(
                        advisories_to_create,
                        update_conflicts=True,
                        unique_fields=["external_id", "source"],  # Or your unique constraint fields
                        update_fields=["raw_payload", "normalized_at", "fetched_at"]  # Resets normalized_at to NULL on upsert!
                    )
                    total_processed += len(advisories_to_create)

                start_index += len(vulnerabilities)

                # Free RAM & clear query logs
                del advisories_to_create
                del vulnerabilities
                del data
                del raw_text

                reset_queries()
                gc.collect()

                if start_index >= total_results:
                    break

                logger.info(f"[NVD] Progress: {start_index}/{total_results}")

                time.sleep(delay)

            # Clean completion always sets run_start_time as the latest sync checkpoint
            final_sync_time = run_start_time

            # 3. Mutate active row to SUCCESS
            self.record_success(
                sync_record=sync_record,
                records_processed=total_processed,
                sync_time=final_sync_time,
            )

            logger.info(
                f"[NVD] Completed run successfully. Total advisories processed: {total_processed} | "
                f"New Checkpoint: {final_sync_time}"
            )

        except Exception as pipeline_error:
            error_trace = (
                f"Pipeline execution halted due to exception: {pipeline_error}"
            )
            logger.critical(f"[NVD] {error_trace}")

            # Safely log FAILED status without causing atomic transaction rollbacks
            with transaction.atomic():
                self.record_failure(sync_record=sync_record, error_message=error_trace)

            raise