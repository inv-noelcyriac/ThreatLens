import gc
import json
import logging
import os
import time

from django.db import reset_queries
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

    DEFAULT_API_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"

    def validate_schema(self, external_id: str, payload_dict: dict) -> bool:
        cve_block = payload_dict.get("cve", {})
        return super().validate_schema(external_id, cve_block)

    def run(self, start_index: int = None) -> None:
        logger.info("[NVD] Starting optimized NVD ingestion worker...")

        api_url = os.environ.get("NVD_API_URL") or self.DEFAULT_API_URL
        api_key = os.environ.get("NVD_API_KEY")
        headers = {}

        if api_key:
            headers["apiKey"] = api_key
            delay = API_DELAY_WITH_KEY
            logger.info("[NVD] API key detected. Performance rate-limiting enabled.")
        else:
            delay = API_DELAY_WITHOUT_KEY
            logger.warning("[NVD] Running without API key. Reduced request rate enforced.")

        if start_index is None:
            existing_count = SourceAdvisory.objects.filter(source=self.source_name).count()
            start_index = (existing_count // RESULTS_PER_PAGE) * RESULTS_PER_PAGE
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

                logger.info(f"[NVD] Fetching batch starting at index {start_index}")

                raw_text = self.fetch_with_retry(
                    target_url=api_url,
                    headers=headers,
                    params=params,
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
                    logger.info("[NVD] Empty vulnerability list returned. Feed processing completed.")
                    break

                total_results = data.get("totalResults", 0)

                logger.info(
                    f"[NVD] Retrieved {len(vulnerabilities)} records "
                    f"({start_index}/{total_results})"
                )

                # -------------------------------------------------------------
                # 1. SPEED OPTIMIZATION: BATCH PREPARATION
                # -------------------------------------------------------------
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

                # -------------------------------------------------------------
                # 2. SPEED OPTIMIZATION: SINGLE BULK DB TRANSACTION
                # -------------------------------------------------------------
                if advisories_to_create:
                    SourceAdvisory.objects.bulk_create(
                        advisories_to_create,
                        ignore_conflicts=True
                    )
                    total_processed += len(advisories_to_create)

                start_index += len(vulnerabilities)

                # -------------------------------------------------------------
                # 3. MEMORY OPTIMIZATION: FREE RAM & CLEAR QUERY LOGS
                # -------------------------------------------------------------
                del advisories_to_create
                del vulnerabilities
                del data
                del raw_text

                reset_queries()  # Clears Django's query execution memory
                gc.collect()     # Forces Python GC to instantly reclaim RAM

                if start_index >= total_results:
                    break

                logger.info(f"[NVD] Progress: {start_index}/{total_results}")

                time.sleep(delay)

            logger.info(
                f"[NVD] Completed initial run successfully. Total advisories processed: {total_processed}"
            )

        except Exception as pipeline_error:
            logger.critical(
                f"[NVD] Pipeline execution halted due to exception: {pipeline_error}"
            )
            raise