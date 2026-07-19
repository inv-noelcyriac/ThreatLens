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
    source_name: str = ""
    required_keys: list[str] = []

    def fetch_with_retry(self, target_url: str, params: dict | None = None) -> str:
        """
        Fetches raw data with industry-standard Full Jitter Exponential Backoff.
        
        Args:
            target_url (str): The destination endpoint (without query parameters encoded).
            params (dict): Optional key-value query parameters to pass to the request.
        """
        source_name = self.source_name or "unknown"
        if not target_url:
            raise ValueError(f"Target URL for source '{source_name}' must be explicitly provided.")

        max_retries = 5
        base_delay = 2     # The starting delay multiplier in seconds
        max_backoff = 60   # Upper boundary cap to prevent excessive idle wait times
        timeout_seconds = 30

        for attempt in range(1, max_retries + 1):
            try:
                logger.info(f"[{source_name.upper()}] Fetching data from endpoint (Attempt {attempt}/{max_retries})...")
                
                # Passing parameters strictly via the 'params' kwarg guarantees correct character encoding
                response = requests.get(target_url, params=params, timeout=timeout_seconds)
                response.raise_for_status()
                
                status_suffix = f" [HTTP STATUS: {response.status_code}]"
                logger.info(f"[{source_name.upper()}] Payload successfully retrieved.{status_suffix}")
                return response.text

            except requests.RequestException as e:
                status_suffix = ""
                if e.response is not None:
                    status_suffix = f" [HTTP STATUS: {e.response.status_code}]"
                
                logger.warning(f"[{source_name.upper()}] Attempt {attempt} failed.{status_suffix} Error: {str(e)}")
                
                if attempt == max_retries:
                    logger.error(f"[{source_name.upper()}] CRITICAL: Max retries reached.{status_suffix} Data ingestion aborted.")
                    raise e
                
                # Calculate exponential ceiling: base_delay * (2 ^ attempt) capped at max_backoff
                calculated_ceiling = min(max_backoff, base_delay * (2 ** attempt))
                
                # Apply Full Jitter: Sleep for a totally random time between 0.5s and the ceiling
                sleep_time = random.uniform(0.5, calculated_ceiling)
                
                logger.info(f"[{source_name.upper()}] Exponential delay applied: Sleeping for {sleep_time:.2f} seconds...")
                time.sleep(sleep_time)

        raise RuntimeError(f"[{source_name.upper()}] Ingestion loop terminated unexpectedly.")

    def validate_schema(self, external_id: str, payload_dict: dict) -> bool:
        """
        Verifies that vendor-provided dictionary contains all mandatory keys.
        Logs a distinct critical alert message if the schema breaks.
        """
        source_name = self.source_name or "unknown"
        if not isinstance(payload_dict, dict):
            logger.error(f"[ALERT-DEV] SCHEMA CRITICAL FAULT for {source_name.upper()} ({external_id}): Payload is not a valid structured dictionary object!")
            return False

        missing_keys = [key for key in self.required_keys if key not in payload_dict]
        if missing_keys:
            logger.error(
                f"[ALERT-DEV] VENDOR SCHEMA MISMATCH detected for {source_name.upper()} ({external_id})! "
                f"The vendor has modified field names. Missing expected keys: {missing_keys}. "
                f"Payload dump: {payload_dict}"
            )
            return False
        return True

    def save_advisory(self, external_id: str, raw_payload: dict) -> None:
        """
        Saves or updates rows wrapped inside an atomic database transaction block.
        Ensures strict idempotency even if connection drops mid-execution.
        """
        source_name = self.source_name or "unknown"
        if not self.validate_schema(external_id, raw_payload):
            return  # Halted for this row. Developer alert is already logged.

        try:
            with transaction.atomic():
                advisory, created = SourceAdvisory.objects.update_or_create(
                    source=source_name,
                    external_id=external_id,
                    defaults={'raw_payload': raw_payload}
                )
                if created:
                    logger.info(f"[{source_name.upper()}] Idempotent Insert: Saved new advisory {external_id}")
                else:
                    logger.info(f"[{source_name.upper()}] Idempotent Update: Refreshed existing advisory {external_id}")
        except Exception as e:
            logger.error(f"[{source_name.upper()}] Network/DB Connection Lost during save for {external_id}. Error: {str(e)}")