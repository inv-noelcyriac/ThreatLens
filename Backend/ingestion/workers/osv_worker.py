import json
import logging
import os
import tempfile
import zipfile

from ingestion.tasks import BaseIngestionTask

logger = logging.getLogger("ingestion_logger")


class OSVZipIngestionTask(BaseIngestionTask):
    """
    Production OSV Ingestion Worker.
    """

    source_name = "osv"

    required_keys = [
        "id",
        "modified",
    ]

    def run(self) -> None:
        logger.info("[OSV] Initializing OSV global snapshot ingestion worker...")

        # 1. Fetching the URL dynamically inside the running context. 
        # By the time run() executes, Django has fully populated os.environ.
        target_url = os.getenv("OSV_URL")
        
        if not target_url:
            logger.critical("[OSV] Pipeline failed to start: OSV_URL environment variable is missing.")
            raise ValueError("Target URL for source 'osv' must be explicitly provided via environment config.")

        total_processed = 0

        with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp_file:
            tmp_path = tmp_file.name

            try:
                logger.info(f"[OSV] Streaming download from remote: {target_url}")

                response = self.fetch_with_retry(
                    target_url=target_url,
                    stream=True,
                )

                for chunk in response.iter_content(chunk_size=128 * 1024):
                    if chunk:
                        tmp_file.write(chunk)

                tmp_file.flush()

                logger.info("[OSV] Local snapshot download complete. Beginning archive processing...")

                with zipfile.ZipFile(tmp_path, "r") as archive:
                    json_files = [
                        name
                        for name in archive.namelist()
                        if name.endswith(".json")
                    ]

                    total_files = len(json_files)
                    logger.info(f"[OSV] Found {total_files} advisory files inside snapshot.")

                    for index, file_name in enumerate(json_files, start=1):
                        try:
                            with archive.open(file_name) as json_file:
                                advisory = json.load(json_file)

                            external_id = advisory.get("id")
                            if not external_id:
                                continue

                            self.save_advisory(
                                external_id=external_id,
                                raw_payload=advisory,
                            )

                            total_processed += 1

                            if index % 5000 == 0 or index == total_files:
                                logger.info(
                                    f"[OSV] Progress: {index}/{total_files} advisories processed."
                                )

                        except (json.JSONDecodeError, TypeError) as parse_error:
                            logger.error(
                                f"[OSV] Failed to parse '{file_name}'. Error: {str(parse_error)}"
                            )
                            continue

                logger.info(
                    f"[OSV] Snapshot processing completed successfully. Total processed: {total_processed}"
                )

            except Exception as pipeline_error:
                logger.critical(f"[OSV] Pipeline terminated unexpectedly. Error: {str(pipeline_error)}")
                raise

            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                    logger.info("[OSV] Temporary snapshot removed successfully.")