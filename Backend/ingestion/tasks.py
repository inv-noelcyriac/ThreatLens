# import logging
# import random
# import requests
# import time
# from django.db import transaction
# from .models import SourceAdvisory

# # Explicitly import urllib3 exceptions to detect low-level DNS resolution failures
# try:
#     from urllib3.exceptions import NameResolutionError
# except ImportError:
#     NameResolutionError = tuple()  # Fallback if urllib3 version differs

# logger = logging.getLogger('ingestion_logger')


# class BaseIngestionTask:
#     """
#     Production-grade base task handling:
#     - Network Failure Self-Healing Loop (waits for DNS/connectivity restoration)
#     - Full Jitter Exponential Backoff for API rate limits & remote HTTP errors
#     - Safe Transaction-isolated Idempotency (handles sudden DB drops mid-run)
#     - Structural Schema Validation & Alerting via log file
#     """
#     source_name: str = ""
#     required_keys: list[str] = []

#     def is_network_connectivity_error(self, exc: Exception) -> bool:
#         """
#         Detects if the exception was caused by a local/network infrastructure drop
#         (e.g. DNS resolution failure, connection refused, Wi-Fi disconnect)
#         rather than a remote HTTP server status response.
#         """
#         # If we received an HTTP response object, the network itself is working
#         if isinstance(exc, requests.RequestException) and exc.response is not None:
#             return False

#         # Direct connection error or underlying DNS resolution failure
#         if isinstance(exc, (requests.exceptions.ConnectionError, requests.exceptions.Timeout)):
#             return True

#         if NameResolutionError and isinstance(exc, NameResolutionError):
#             return True

#         # Fallback string check for low-level socket/DNS resolution error messages
#         err_str = str(exc).lower()
#         dns_indicators = [
#             "nameresolutionerror",
#             "temporary failure in name resolution",
#             "failed to resolve",
#             "getaddrinfo failed",
#             "connection refused",
#         ]
#         return any(indicator in err_str for indicator in dns_indicators)

#     def fetch_with_retry(
#         self,
#         target_url: str,
#         params: dict | None = None,
#         headers: dict | None = None,
#         stream: bool = False,
#     ) -> requests.Response | str:
#         """
#         Fetches data with industry-standard Full Jitter Exponential Backoff
#         and Infinite Self-Healing Recovery for local network drops.
#         """
#         source_name = self.source_name or "unknown"
#         if not target_url:
#             raise ValueError(f"Target URL for source '{source_name}' must be explicitly provided.")

#         max_api_retries = 5
#         base_delay = 2       # Starting delay multiplier in seconds
#         max_backoff = 60     # Upper boundary cap for backoff sleep
#         timeout_seconds = 30
#         network_heal_sleep = 30  # Sleep time during local network outages

#         attempt = 1
#         network_outage_count = 0

#         while attempt <= max_api_retries:
#             try:
#                 logger.info(f"[{source_name.upper()}] Fetching data from endpoint (Attempt {attempt}/{max_api_retries})...")

#                 response = requests.get(
#                     target_url,
#                     params=params,
#                     headers=headers,
#                     stream=stream,
#                     timeout=timeout_seconds
#                 )
#                 response.raise_for_status()

#                 status_suffix = f" [HTTP STATUS: {response.status_code}]"
#                 logger.info(f"[{source_name.upper()}] Payload successfully retrieved.{status_suffix}")

#                 # Dynamic return execution boundary
#                 if stream:
#                     return response
#                 return response.text

#             except requests.RequestException as e:
#                 # -------------------------------------------------------------
#                 # SCENARIO A: Local Network / DNS Outage
#                 # Do NOT increment attempt count or burn max_retries!
#                 # -------------------------------------------------------------
#                 if self.is_network_connectivity_error(e):
#                     network_outage_count += 1
#                     logger.warning(
#                         f"[{source_name.upper()}] Local network / DNS outage detected! "
#                         f"Error: {str(e)}. "
#                         f"Pausing task for {network_heal_sleep}s (Outage cycle #{network_outage_count})..."
#                     )
#                     time.sleep(network_heal_sleep)
#                     # Retry without advancing the HTTP retry attempt counter
#                     continue

#                 # -------------------------------------------------------------
#                 # SCENARIO B: Remote API / HTTP Error (e.g., 500, 503, 429)
#                 # -------------------------------------------------------------
#                 status_suffix = ""
#                 if e.response is not None:
#                     status_suffix = f" [HTTP STATUS: {e.response.status_code}]"

#                 logger.warning(f"[{source_name.upper()}] Attempt {attempt} failed.{status_suffix} Error: {str(e)}")

#                 if attempt == max_api_retries:
#                     logger.error(f"[{source_name.upper()}] CRITICAL: Max API retries reached.{status_suffix} Data ingestion aborted.")
#                     raise e

#                 # Calculate exponential ceiling with full jitter
#                 calculated_ceiling = min(max_backoff, base_delay * (2 ** attempt))
#                 sleep_time = random.uniform(0.5, calculated_ceiling)

#                 logger.info(f"[{source_name.upper()}] Exponential delay applied: Sleeping for {sleep_time:.2f} seconds...")
#                 time.sleep(sleep_time)
#                 attempt += 1

#         raise RuntimeError(f"[{source_name.upper()}] Ingestion loop terminated unexpectedly.")

#     def validate_schema(self, external_id: str, payload_dict: dict) -> bool:
#         """
#         Verifies that vendor-provided dictionary contains all mandatory keys.
#         """
#         source_name = self.source_name or "unknown"
#         if not isinstance(payload_dict, dict):
#             logger.error(
#                 f"[ALERT-DEV] SCHEMA CRITICAL FAULT for {source_name.upper()} ({external_id}): "
#                 f"Payload is not a valid structured dictionary object!"
#             )
#             return False

#         missing_keys = [key for key in self.required_keys if key not in payload_dict]
#         if missing_keys:
#             logger.error(
#                 f"[ALERT-DEV] VENDOR SCHEMA MISMATCH detected for {source_name.upper()} ({external_id})! "
#                 f"Missing expected keys: {missing_keys}. "
#                 f"Payload dump: {payload_dict}"
#             )
#             return False
#         return True

#     def save_advisory(self, external_id: str, raw_payload: dict) -> None:
#         """
#         Saves or updates rows wrapped inside an atomic database transaction block.
#         """
#         source_name = self.source_name or "unknown"

#         if not self.validate_schema(external_id, raw_payload):
#             logger.warning(f"[{source_name.upper()}] Validation skipped record: {external_id}")
#             return

#         try:
#             with transaction.atomic():
#                 advisory, created = SourceAdvisory.objects.update_or_create(
#                     source=source_name,
#                     external_id=external_id,
#                     defaults={'raw_payload': raw_payload}
#                 )
#                 if created:
#                     logger.info(f"[{source_name.upper()}] Idempotent Insert: Saved new advisory {external_id}")
#                 else:
#                     logger.info(f"[{source_name.upper()}] Idempotent Update: Refreshed existing advisory {external_id}")
#         except Exception as e:
#             logger.error(f"[{source_name.upper()}] Network/DB Connection Lost during save for {external_id}. Error: {str(e)}")

#---- INCREMENTAL SYNC -----
import gc
import json
import logging
import os
import subprocess
from pathlib import Path

from django.conf import settings
from django.db import reset_queries
from ingestion.models import SourceAdvisory
from ingestion.tasks import BaseIngestionTask

logger = logging.getLogger("ingestion_logger")


class GHSAGitSyncTask(BaseIngestionTask):
    """
    Incremental Sync Worker for GHSA.
    Fetches only updated/new JSON files from git commit history.
    """

    source_name = "ghsa"
    required_keys = ["id", "modified"]

    DEFAULT_REPO_PATH = str(Path(settings.BASE_DIR) / "data" / "ghsa_repo")
    LOCAL_REPO_DIR = os.environ.get("GHSA_REPO_DIR", DEFAULT_REPO_PATH)

    def _run_git_cmd(self, args: list[str], repo_path: Path) -> str:
        res = subprocess.run(
            ["git", "-C", str(repo_path)] + args,
            capture_output=True,
            text=True,
            check=True,
        )
        return res.stdout.strip()

    def run(self) -> None:
        logger.info("[GHSA Sync] Starting incremental sync check...")
        repo_path = Path(self.LOCAL_REPO_DIR)

        if not repo_path.exists():
            logger.error(
                f"[GHSA Sync] Repository path {repo_path} does not exist. Run initial ingestion first."
            )
            return

        # 1. Capture HEAD before pulling
        old_head = self._run_git_cmd(["rev-parse", "HEAD"], repo_path)

        # 2. Pull latest changes
        logger.info("[GHSA Sync] Pulling latest repository commits...")
        self._run_git_cmd(["pull"], repo_path)

        # 3. Capture HEAD after pulling
        new_head = self._run_git_cmd(["rev-parse", "HEAD"], repo_path)

        if old_head == new_head:
            logger.info("[GHSA Sync] Repository is already up to date. No new commits.")
            return

        # 4. Find all changed or newly added .json files between commit hashes
        diff_output = self._run_git_cmd(
            ["diff", "--name-only", "--diff-filter=ACMR", old_head, new_head],
            repo_path,
        )

        changed_files = [
            f for f in diff_output.splitlines()
            if f.endswith(".json") and not f.endswith(("package.json", "package-lock.json"))
        ]

        if not changed_files:
            logger.info("[GHSA Sync] Commits fetched, but no advisory JSON files were modified.")
            return

        logger.info(f"[GHSA Sync] Found {len(changed_files)} updated/new advisory files.")

        updated_count = 0
        batch_buffer = []

        # 5. Parse only modified files
        for relative_file_path in changed_files:
            full_path = repo_path / relative_file_path
            if not full_path.exists():
                continue

            ghsa_id = full_path.stem

            try:
                with open(full_path, "r", encoding="utf-8") as f:
                    payload = json.load(f)
            except Exception as read_err:
                logger.error(f"[GHSA Sync] Failed to read {full_path.name}: {read_err}")
                continue

            external_id = payload.get("id") or ghsa_id

            missing = set(self.required_keys) - set(payload.keys())
            if missing:
                logger.warning(
                    f"[GHSA Sync] Schema warning [{external_id}]: Missing keys {missing}"
                )
                continue

            batch_buffer.append(
                SourceAdvisory(
                    external_id=external_id,
                    source=self.source_name,
                    raw_payload=payload,
                )
            )

        # 6. Upsert records into PostgreSQL (Update payload if external_id exists)
        if batch_buffer:
            SourceAdvisory.objects.bulk_create(
                batch_buffer,
                update_conflicts=True,
                unique_fields=["external_id"],
                update_fields=["raw_payload", "source"],
            )
            updated_count = len(batch_buffer)

        reset_queries()
        gc.collect()

        logger.info(
            f"[GHSA Sync] Successfully synchronized {updated_count} advisories from Git range ({old_head[:7]}..{new_head[:7]})."
        )