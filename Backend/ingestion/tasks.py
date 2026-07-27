# ingestion/tasks.py
import logging
import random
import time
from datetime import datetime
import requests
from django.db import transaction
from django.utils import timezone

from .models import SourceAdvisory, SyncState
from .services import (
    get_last_successful_sync,
    start_sync_run,
    finish_sync_run_success,
    finish_sync_run_failure,
)

# Explicitly import urllib3 exceptions to detect low-level DNS resolution failures
try:
    from urllib3.exceptions import NameResolutionError
except ImportError:
    NameResolutionError = tuple()  # Fallback if urllib3 version differs

logger = logging.getLogger("ingestion_logger")


class BaseIngestionTask:
    """
    Production-grade base task handling:
    - Base Class position at top of module to eliminate subclass import NameErrors
    - Single-row mutating SyncState tracking (1 row per execution run)
    - Network Failure Self-Healing Loop (waits for DNS/connectivity restoration)
    - Full Jitter Exponential Backoff for API rate limits & remote HTTP errors
    - Safe Transaction-isolated Idempotency (handles sudden DB drops mid-run)
    - Structural Schema Validation & Alerting via log file
    """

    source_name: str = ""
    required_keys: list[str] = []

    # -------------------------------------------------------------------------
    # Single-Row SyncState Lifecycle Helpers
    # -------------------------------------------------------------------------

    def get_last_checkpoint(self) -> datetime | None:
        """Retrieves the latest successful sync timestamp threshold for incremental syncs."""
        return get_last_successful_sync(self.source_name)

    def record_start(self, last_checkpoint: datetime | None = None) -> SyncState:
        """
        Creates the single tracking record for this execution run in RUNNING state.
        Returns the created model instance to be updated throughout the lifecycle.
        """
        return start_sync_run(
            source_name=self.source_name,
            last_checkpoint=last_checkpoint,
        )

    def record_success(
        self,
        sync_record: SyncState,
        records_processed: int,
        sync_time: datetime | None = None,
    ) -> None:
        """
        Mutates the active execution row to SUCCESS upon clean completion.
        """
        finish_sync_run_success(
            sync_record=sync_record,
            records=records_processed,
            sync_time=sync_time,
        )

    def record_failure(
        self, sync_record: SyncState, error_message: str
    ) -> None:
        """
        Mutates the active execution row to FAILED while preserving the original checkpoint anchor.
        """
        finish_sync_run_failure(
            sync_record=sync_record,
            error=error_message,
        )

    # -------------------------------------------------------------------------
    # Network Retry & Error Detection
    # -------------------------------------------------------------------------

    def is_network_connectivity_error(self, exc: Exception) -> bool:
        """
        Detects if the exception was caused by a local/network infrastructure drop
        (e.g., DNS resolution failure, connection refused, Wi-Fi disconnect)
        rather than a remote HTTP server status response.
        """
        if isinstance(exc, requests.RequestException) and exc.response is not None:
            return False

        if isinstance(
            exc, (requests.exceptions.ConnectionError, requests.exceptions.Timeout)
        ):
            return True

        if NameResolutionError and isinstance(exc, NameResolutionError):
            return True

        err_str = str(exc).lower()
        dns_indicators = [
            "nameresolutionerror",
            "temporary failure in name resolution",
            "failed to resolve",
            "getaddrinfo failed",
            "connection refused",
        ]
        return any(indicator in err_str for indicator in dns_indicators)

    def fetch_with_retry(
        self,
        target_url: str,
        params: dict | None = None,
        headers: dict | None = None,
        stream: bool = False,
    ) -> requests.Response | str:
        """
        Fetches data with Full Jitter Exponential Backoff
        and Infinite Self-Healing Recovery for local network drops.
        """
        source_name = self.source_name or "unknown"
        if not target_url:
            raise ValueError(
                f"Target URL for source '{source_name}' must be explicitly provided."
            )

        max_api_retries = 5
        base_delay = 2  # Starting delay multiplier in seconds
        max_backoff = 60  # Upper boundary cap for backoff sleep
        timeout_seconds = 30
        network_heal_sleep = 30  # Sleep time during local network outages

        attempt = 1
        network_outage_count = 0

        while attempt <= max_api_retries:
            try:
                logger.info(
                    f"[{source_name.upper()}] Fetching data from endpoint (Attempt {attempt}/{max_api_retries})..."
                )

                response = requests.get(
                    target_url,
                    params=params,
                    headers=headers,
                    stream=stream,
                    timeout=timeout_seconds,
                )
                response.raise_for_status()

                status_suffix = f" [HTTP STATUS: {response.status_code}]"
                logger.info(
                    f"[{source_name.upper()}] Payload successfully retrieved.{status_suffix}"
                )

                if stream:
                    return response
                return response.text

            except requests.RequestException as e:
                # SCENARIO A: Local Network / DNS Outage
                if self.is_network_connectivity_error(e):
                    network_outage_count += 1
                    logger.warning(
                        f"[{source_name.upper()}] Local network / DNS outage detected! "
                        f"Error: {str(e)}. "
                        f"Pausing task for {network_heal_sleep}s (Outage cycle #{network_outage_count})..."
                    )
                    time.sleep(network_heal_sleep)
                    continue

                # SCENARIO B: Remote API / HTTP Error (500, 503, 429, etc.)
                status_suffix = ""
                if e.response is not None:
                    status_suffix = f" [HTTP STATUS: {e.response.status_code}]"

                logger.warning(
                    f"[{source_name.upper()}] Attempt {attempt} failed.{status_suffix} Error: {str(e)}"
                )

                if attempt == max_api_retries:
                    logger.error(
                        f"[{source_name.upper()}] CRITICAL: Max API retries reached.{status_suffix} Data ingestion aborted."
                    )
                    raise e

                calculated_ceiling = min(max_backoff, base_delay * (2**attempt))
                sleep_time = random.uniform(0.5, calculated_ceiling)

                logger.info(
                    f"[{source_name.upper()}] Exponential delay applied: Sleeping for {sleep_time:.2f} seconds..."
                )
                time.sleep(sleep_time)
                attempt += 1

        raise RuntimeError(
            f"[{source_name.upper()}] Ingestion loop terminated unexpectedly."
        )

    # -------------------------------------------------------------------------
    # Schema Validation & Database Operations
    # -------------------------------------------------------------------------

    def validate_schema(self, external_id: str, payload_dict: dict) -> bool:
        """Verifies that vendor-provided dictionary contains all mandatory keys."""
        source_name = self.source_name or "unknown"
        if not isinstance(payload_dict, dict):
            logger.error(
                f"[ALERT-DEV] SCHEMA CRITICAL FAULT for {source_name.upper()} ({external_id}): "
                f"Payload is not a valid structured dictionary object!"
            )
            return False

        missing_keys = [key for key in self.required_keys if key not in payload_dict]
        if missing_keys:
            logger.error(
                f"[ALERT-DEV] VENDOR SCHEMA MISMATCH detected for {source_name.upper()} ({external_id})! "
                f"Missing expected keys: {missing_keys}. "
                f"Payload dump: {payload_dict}"
            )
            return False
        return True

    def save_advisory(self, external_id: str, raw_payload: dict) -> None:
        """Saves or updates rows wrapped inside an atomic database transaction block."""
        source_name = self.source_name or "unknown"

        if not self.validate_schema(external_id, raw_payload):
            logger.warning(
                f"[{source_name.upper()}] Validation skipped record: {external_id}"
            )
            return

        try:
            with transaction.atomic():
                advisory, created = SourceAdvisory.objects.update_or_create(
                    source=source_name,
                    external_id=external_id,
                    defaults={"raw_payload": raw_payload},
                )
                if created:
                    logger.info(
                        f"[{source_name.upper()}] Idempotent Insert: Saved new advisory {external_id}"
                    )
                else:
                    logger.info(
                        f"[{source_name.upper()}] Idempotent Update: Refreshed existing advisory {external_id}"
                    )
        except Exception as e:
            logger.error(
                f"[{source_name.upper()}] Network/DB Connection Lost during save for {external_id}. Error: {str(e)}"
            )
            raise e


# =============================================================================
# SCHEDULER TASK WRAPPERS WITH POSTGRES DB LOCKING
# =============================================================================




def is_worker_running(source_name: str) -> bool:
    """
    Checks if an ingestion run for the given source is active.
    Returns True ONLY if a record with last_run_status='RUNNING' exists and is locked.
    """
    try:
        with transaction.atomic():
            running_task = (
                SyncState.objects.select_for_update(nowait=True)
                .filter(source=source_name, last_run_status="RUNNING")
                .first()
            )
            # If running_task is None, no task is currently running
            if running_task is None:
                return False
            # A task is actively running and locked
            return True
    except Exception:
        # DB row lock held by another process
        return True


def run_ghsa_ingestion():
    """Executes daily GHSA Git ingestion task."""
    if is_worker_running("ghsa"):
        logger.warning("[GHSA] Task skipped: Previous run is still active in DB.")
        return "SKIPPED_ALREADY_RUNNING"

    from .workers.ghsa_git_worker import GHSAGitTask

    logger.info("[APSCHEDULER] Triggering scheduled GHSA ingestion...")
    GHSAGitTask().run()
    return "SUCCESS"


def run_nvd_ingestion():
    """Executes daily NVD API ingestion task."""
    if is_worker_running("nvd"):
        logger.warning("[NVD] Task skipped: Previous run is still active in DB.")
        return "SKIPPED_ALREADY_RUNNING"

    from .workers.nvd_worker import NVDApiTask

    logger.info("[APSCHEDULER] Triggering scheduled NVD ingestion...")
    NVDApiTask().run()
    return "SUCCESS"


def run_osv_ingestion():
    """Executes daily OSV Zip stream ingestion task."""
    if is_worker_running("osv"):
        logger.warning("[OSV] Task skipped: Previous run is still active in DB.")
        return "SKIPPED_ALREADY_RUNNING"

    from .workers.osv_worker import OSVZipIngestionTask

    logger.info("[APSCHEDULER] Triggering scheduled OSV ingestion...")
    OSVZipIngestionTask().run()
    return "SUCCESS"


def run_aws_ingestion():
    """Executes daily AWS Security Bulletins ingestion task."""
    if is_worker_running("aws"):
        logger.warning("[AWS] Task skipped: Previous run is still active in DB.")
        return "SKIPPED_ALREADY_RUNNING"

    from .workers.aws_worker import AWSIngestionTask

    logger.info("[APSCHEDULER] Triggering scheduled AWS ingestion...")
    AWSIngestionTask().run()
    return "SUCCESS"


def run_docker_ingestion():
    """Executes daily Docker Ecosystem & Hardened OSV ingestion tasks."""
    if is_worker_running("docker_ecosystem"):
        logger.warning("[DOCKER] Task skipped: Previous run is still active in DB.")
        return "SKIPPED_ALREADY_RUNNING"

    from .workers.docker_worker import DockerEcosystemTask, DockerHardenedOSVTask

    logger.info("[APSCHEDULER] Triggering scheduled Docker Ecosystem ingestion...")
    DockerEcosystemTask().run()

    logger.info("[APSCHEDULER] Triggering scheduled Docker Hardened OSV ingestion...")
    DockerHardenedOSVTask().run()
    return "SUCCESS"