import logging
import random
import requests
import time
from django.db import IntegrityError, transaction
from .models import SourceAdvisory

logger = logging.getLogger('ingestion_logger')

class BaseIngestionTask:
    """
    Production-grade base task handling:
    - Full Jitter Exponential Backoff (prevents vendor blocking & thundering herds)
    - Safe Transaction-isolated Idempotency (handles sudden network/DB drops mid-run)
    - Structural Schema Validation & Alerting via log file
    """
    source_name = None
    target_url = None
    required_keys = []  # List of top-level keys required for schema validation
    def fetch_with_retry(self):
            """Fetches raw data with industry-standard Full Jitter Exponential Backoff."""
            if not self.target_url:
                raise ValueError(f"Target URL for source '{self.source_name}' is not configured.")

            from urllib.parse import urlparse, parse_qs

            max_retries = 5
            base_delay = 2  # The starting delay multiplier in seconds
            max_backoff = 60  # Upper boundary cap to prevent excessive idle wait times
            timeout_seconds = 30

            # Parse the configured target URL to extract the clean base URL and its query parameters
            parsed_url = urlparse(self.target_url)
            base_url = f"{parsed_url.scheme}://{parsed_url.netloc}{parsed_url.path}"
            
            # Extract existing query params and flatten the lists into single strings
            query_params = {k: v[0] for k, v in parse_qs(parsed_url.query).items()}

            # Defensive guard: NVD 2.0 API will throw a hard 404 if resultsPerPage exceeds 1000
            if 'resultsPerPage' in query_params:
                try:
                    query_params['resultsPerPage'] = min(int(query_params['resultsPerPage']), 1000)
                except ValueError:
                    pass

            for attempt in range(1, max_retries + 1):
                try:
                    logger.info(f"[{self.source_name.upper()}] Fetching data (Attempt {attempt}/{max_retries})...")
                    
                    # Passing the parameters via 'params' forces requests to encode wildcards (*) properly
                    response = requests.get(base_url, params=query_params, timeout=timeout_seconds)
                    response.raise_for_status()
                    
                    status_suffix = f" [HTTP STATUS: {response.status_code}]"
                    logger.info(f"[{self.source_name.upper()}] Payload successfully retrieved.{status_suffix}")
                    return response.text

                except requests.RequestException as e:
                    # --- Status Code Extraction ---
                    # Check if the exception contains an HTTP response from the server
                    status_suffix = ""
                    if e.response is not None:
                        status_suffix = f" [HTTP STATUS: {e.response.status_code}]"
                    
                    # Appended the status_suffix to your exact original log messages
                    logger.warning(f"[{self.source_name.upper()}] Attempt {attempt} failed.{status_suffix} Error: {str(e)}")
                    if attempt == max_retries:
                        logger.error(f"[{self.source_name.upper()}] CRITICAL: Max retries reached.{status_suffix} Data ingestion aborted.")
                        raise e
                    
                    # 1. Calculate exponential ceiling: base_delay * (2 ^ attempt)
                    # Cap the exponential ceiling at max_backoff so it never sleeps for hours
                    calculated_ceiling = min(max_backoff, base_delay * (2 ** attempt))
                    
                    # 2. Apply Full Jitter: Sleep for a totally random time between 0.5s and the ceiling.
                    # This breaks up request waves perfectly across competitive threads.
                    sleep_time = random.uniform(0.5, calculated_ceiling)
                    
                    logger.info(f"[{self.source_name.upper()}] Exponential delay applied: Sleeping for {sleep_time:.2f} seconds...")
                    time.sleep(sleep_time)

    def validate_schema(self, external_id, payload_dict):
        """
        Verifies that vendor-provided dictionary contains all mandatory keys.
        Logs a distinct critical alert message if the schema breaks.
        """
        if not isinstance(payload_dict, dict):
            logger.error(f"[ALERT-DEV] SCHEMA CRITICAL FAULT for {self.source_name.upper()} ({external_id}): Payload is not a valid structured dictionary object!")
            return False

        missing_keys = [key for key in self.required_keys if key not in payload_dict]
        if missing_keys:
            logger.error(
                f"[ALERT-DEV] VENDOR SCHEMA MISMATCH detected for {self.source_name.upper()} ({external_id})! "
                f"The vendor has modified field names. Missing expected keys: {missing_keys}. "
                f"Payload dump: {payload_dict}"
            )
            return False
        return True

    def save_advisory(self, external_id, raw_payload):
        """
        Saves or updates rows wrapped inside an atomic database transaction block.
        Ensures strict idempotency even if connection drops mid-execution.
        """
        if not self.validate_schema(external_id, raw_payload):
            return  # Halted for this row. Developer alert is already logged.

        try:
            with transaction.atomic():
                advisory, created = SourceAdvisory.objects.update_or_create(
                    source=self.source_name,
                    external_id=external_id,
                    defaults={'raw_payload': raw_payload}
                )
                if created:
                    logger.info(f"[{self.source_name.upper()}] Idempotent Insert: Saved new advisory {external_id}")
                else:
                    logger.info(f"[{self.source_name.upper()}] Idempotent Update: Refreshed existing advisory {external_id}")
        except Exception as e:
            logger.error(f"[{self.source_name.upper()}] Network/DB Connection Lost during save for {external_id}. Error: {str(e)}")