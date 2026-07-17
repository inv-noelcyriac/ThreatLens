import json
import logging
import time
from urllib.parse import urlencode
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
    source_name = 'docker_hardened_osv'
    target_url = 'https://raw.githubusercontent.com/docker-hardened-images/advisories/main/index.json'
    required_keys = ['id', 'modified', 'schema_version', 'details']

    def run(self):
        logger.info(f"[{self.source_name.upper()}] Launching live production index run...")
        
        try:
            # 1. Fetch the live index file over the network
            index_raw = self.fetch_with_retry()
            index_data = json.loads(index_raw)
            
            advisory_files = index_data.get('advisories', [])
            logger.info(f"[{self.source_name.upper()}] Discovered {len(advisory_files)} live vulnerability targets.")
            
            base_url = "https://raw.githubusercontent.com/docker-hardened-images/advisories/main/"
            
            for file_name in advisory_files:
                # Update URL dynamically to point to the specific child vulnerability file
                self.target_url = f"{base_url}{file_name}"
                
                try:
                    logger.info(f"[{self.source_name.upper()}] Fetching live target file: {file_name}")
                    raw_osv_payload = self.fetch_with_retry()
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

    source_name = "docker_ecosystem"
    BASE_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"

    # CRITICAL FIX: NVD API 2.0 will throw a 404 if this is > 1000.
    RESULTS_PER_PAGE = 1000

    # Rate limiting delay in seconds. 
    # Use 6.0 seconds if you do NOT have an API key. 
    # Can be lowered to 0.6 seconds if you pass an NVD API key.
    RATE_LIMIT_DELAY = 6.0 

    CPE_IDENTIFIERS = DOCKER_ECOSYSTEM_CPES

    def run(self):
        logger.info(
            f"[{self.source_name.upper()}] Starting Docker ecosystem ingestion..."
        )

        total_saved = 0

        for identifier_name, cpe in self.CPE_IDENTIFIERS:
            logger.info(
                f"[{self.source_name.upper()}] Processing [{identifier_name}]"
            )

            start_index = 0

            while True:
                params = {
                    "virtualMatchString": cpe,
                    "startIndex": start_index,
                    "resultsPerPage": self.RESULTS_PER_PAGE,
                }

                self.target_url = (
                    f"{self.BASE_URL}?{urlencode(params)}"
                )

                try:
                    raw_text = self.fetch_with_retry()
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
                            external_id=cve_id,
                            raw_payload=item
                        )
                        total_saved += 1

                    start_index += self.RESULTS_PER_PAGE

                    if start_index >= total_results:
                        break

                    # Be nice to NVD's fragile servers to prevent HTTP 403/503 errors
                    time.sleep(self.RATE_LIMIT_DELAY)

                except Exception:
                    logger.exception(
                        f"[{identifier_name}] Ingestion failed."
                    )
                    break

        logger.info(
            f"[{self.source_name.upper()}] "
            f"Completed successfully. "
            f"Total advisories processed: {total_saved}"
        )