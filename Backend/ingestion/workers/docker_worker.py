import json
import logging
import time
import os
from ingestion.tasks import BaseIngestionTask

# Single, unified logger setup
logger = logging.getLogger('ingestion_logger')

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

class DockerHardenedOSVTask(BaseIngestionTask):
    """
    [STREAM 1] Production worker tracking container base OS packages.
    Pulls live index and advisory files directly from the GitHub repository.
    """
    source_name: str = 'docker_hardened_osv'
    required_keys = ['id', 'modified', 'schema_version', 'details']

    def run(self):
        logger.info(f"[{self.source_name.upper()}] Launching live production index run...")
        
        target_url = os.environ.get('DOCKER_TARGET_URL')
        if not target_url:
            logger.error(f"[{self.source_name.upper()}] DOCKER_TARGET_URL environment variable is missing.")
            return

        try:
            # 1. Fetch the live index file over the network
            index_raw = self.fetch_with_retry(target_url=target_url)
            if not index_raw:
                logger.error(f"[{self.source_name.upper()}] Index payload is empty or None.")
                return
            index_data = json.loads(index_raw)
            
            advisory_files = index_data.get('advisories', [])
            logger.info(f"[{self.source_name.upper()}] Discovered {len(advisory_files)} live vulnerability targets.")
            
            base_url = os.environ.get('DOCKER_BASE_URL', '')
            
            for file_name in advisory_files:
                # Pass the dynamically constructed file URL directly down functionally 
                # without overwriting instance state parameters.
                file_url = f"{base_url}{file_name}"
                
                try:
                    logger.info(f"[{self.source_name.upper()}] Fetching live target file: {file_name}")
                    raw_osv_payload = self.fetch_with_retry(target_url=file_url)
                    if not raw_osv_payload:
                        logger.error(f"[{self.source_name.upper()}] Target payload is empty or None for file {file_name}.")
                        continue
                    osv_dict = json.loads(raw_osv_payload)
                    
                    external_id = osv_dict.get('id', '').strip()
                    if not external_id:
                        continue
                        
                    self.save_advisory(external_id=external_id, raw_payload=osv_dict)
                    
                except Exception as inner_error:
                    logger.error(f"[{self.source_name.upper()}] Error scraping deep file '{file_name}': {str(inner_error)}")
                    continue
            
            logger.info(f"[{self.source_name.upper()}] Live index processing run completed cleanly.")
            
        except Exception as e:
            logger.error(f"[{self.source_name.upper()}] PIPELINE CRASHED: {str(e)}")


class DockerEcosystemTask(BaseIngestionTask):
    """
    Fetches Docker ecosystem vulnerabilities from NVD.
    """
    source_name: str = "docker_ecosystem"
    CPE_IDENTIFIERS = DOCKER_ECOSYSTEM_CPES

    def run(self):
        logger.info(f"[{self.source_name.upper()}] Starting Docker ecosystem ingestion...")

        base_url = os.environ.get('DOCKER_ECOSYSTEM_BASE_URL')
        if not base_url:
            logger.error(f"[{self.source_name.upper()}] DOCKER_ECOSYSTEM_BASE_URL environment variable is missing.")
            return

        # Safely capture variables out of environment configurations
        try:
            env_results_per_page = int(os.environ.get('DOCKER_RESULTS_PER_PAGE', '1000'))
        except ValueError:
            env_results_per_page = 1000
        
        # Guard: NVD API 2.0 will throw a hard 404/400 validation rule if this exceeds 1000
        results_per_page = min(env_results_per_page, 1000)

        try:
            rate_limit_delay = float(os.environ.get('DOCKER_RATE_LIMIT_DELAY', '6.0'))
        except ValueError:
            rate_limit_delay = 6.0

        total_saved = 0

        for identifier_name, cpe in self.CPE_IDENTIFIERS:
            logger.info(f"[{self.source_name.upper()}] Processing [{identifier_name}]")
            start_index = 0

            while True:
                # Build raw parameters dict without encoding it manually into the URL string
                params = {
                    "virtualMatchString": cpe,
                    "startIndex": start_index,
                    "resultsPerPage": results_per_page,
                }

                try:
                    # Pass parameters explicitly using the updated Base class framework
                    raw_text = self.fetch_with_retry(target_url=base_url, params=params)
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

                        self.save_advisory(external_id=cve_id, raw_payload=item)
                        total_saved += 1

                    start_index += results_per_page

                    if start_index >= total_results:
                        break

                    # Be nice to NVD's rate limits
                    time.sleep(rate_limit_delay)

                except Exception:
                    logger.exception(f"[{identifier_name}] Ingestion failed.")
                    break

        logger.info(
            f"[{self.source_name.upper()}] "
            f"Completed successfully. "
            f"Total advisories processed: {total_saved}"
        )