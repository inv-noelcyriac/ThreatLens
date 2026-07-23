# import os
# import json
# import logging
# import subprocess
# from django.conf import settings
# from ingestion.tasks import BaseIngestionTask

# logger = logging.getLogger('ingestion_logger')

# class GHSAGitTask(BaseIngestionTask):
#     """
#     [STREAM 2] Ingestion worker that clones/pulls the official GitHub Security Advisory (GHSA)
#     database and vaults the raw, unprocessed JSON payloads directly into the database.
#     """
#     source_name: str = 'ghsa_git'

#     def sync_repository(self, repo_url: str, repo_dir: str):
#         """
#         Clones the repo if it doesn't exist, otherwise pulls the latest changes.
#         """
#         parent_dir = os.path.dirname(repo_dir)
#         if not os.path.exists(parent_dir):
#             os.makedirs(parent_dir, exist_ok=True)

#         if not os.path.exists(os.path.join(repo_dir, '.git')):
#             logger.info(f"[{self.source_name.upper()}] Cloning GHSA repository for the first time...")
#             subprocess.run(
#                 ["git", "clone", "--depth", "1", repo_url, repo_dir],
#                 check=True,
#                 stdout=subprocess.DEVNULL,
#                 stderr=subprocess.PIPE
#             )
#         else:
#             logger.info(f"[{self.source_name.upper()}] GHSA repository exists. Pulling latest updates...")
#             subprocess.run(
#                 ["git", "-C", repo_dir, "pull"],
#                 check=True,
#                 stdout=subprocess.DEVNULL,
#                 stderr=subprocess.PIPE
#             )

#     def run(self):
#         logger.info(f"[{self.source_name.upper()}] Starting GHSA Git ingestion task...")
        
#         repo_url = os.environ.get('GHSA_REPO_URL')
#         if not repo_url:
#             logger.error(f"[{self.source_name.upper()}] GHSA_REPO_URL environment variable is missing.")
#             return

#         # Determine target repository directory context dynamically and safely
#         repo_dir = getattr(settings, 'GHSA_REPO_DIR', None)
#         if not repo_dir:
#             repo_dir = os.path.join(str(settings.BASE_DIR), 'data', 'ghsa_repo')

#         try:
#             # 1. Ensure local mirror is up to date
#             self.sync_repository(repo_url=repo_url, repo_dir=repo_dir)
            
#             total_vaulted = 0

#             # 2. Walk directories and find all advisory json files
#             logger.info(f"[{self.source_name.upper()}] Scanning directories for raw payloads...")
#             for root, _, files in os.walk(repo_dir):
#                 if '.git' in root:
#                     continue
                    
#                 for file in files:
#                     if file.endswith('.json'):
#                         file_path = os.path.join(root, file)
                        
#                         try:
#                             with open(file_path, 'r', encoding='utf-8') as f:
#                                 raw_payload = json.load(f)
                            
#                             external_id = raw_payload.get('id', '').strip()
#                             if not external_id:
#                                 continue
                            
#                             # 3. Save directly to the vault
#                             self.save_advisory(external_id=external_id, raw_payload=raw_payload)
#                             total_vaulted += 1
                            
#                         except Exception as file_err:
#                             logger.error(f"[{self.source_name.upper()}] Failed to read file {file}: {str(file_err)}")
#                             continue
            
#             logger.info(f"[{self.source_name.upper()}] GHSA Git ingestion completed. Vaulted {total_vaulted} raw advisories.")
            
#         except Exception as e:
#             logger.error(f"[{self.source_name.upper()}] PIPELINE CRASHED: {str(e)}")

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

BATCH_SIZE = 1000


class GHSAGitTask(BaseIngestionTask):
    """
    Production GHSA Git Ingestion Worker.
    Memory-safe, lightweight console output, automatic fallback parsing.
    """

    source_name = "ghsa"
    # ONLY require keys that are 100% guaranteed by the OSV spec
    required_keys = ["id", "modified"]

    REPO_URL = "https://github.com/github/advisory-database.git"
    
    DEFAULT_REPO_PATH = str(Path(settings.BASE_DIR) / "data" / "ghsa_repo")
    LOCAL_REPO_DIR = os.environ.get("GHSA_REPO_DIR", DEFAULT_REPO_PATH)

    def sync_repository(self) -> Path:
        repo_path = Path(self.LOCAL_REPO_DIR)
        if not repo_path.exists():
            logger.info(f"[GHSA] Cloning repository from {self.REPO_URL}...")
            subprocess.run(
                ["git", "clone", "--depth", "1", self.REPO_URL, str(repo_path)],
                check=True,
            )
        else:
            logger.info(f"[GHSA] Repository exists. Pulling latest commit...")
            subprocess.run(["git", "-C", str(repo_path), "pull"], check=True)
        return repo_path

    def run(self) -> None:
        logger.info("[GHSA] Starting GHSA Git initial ingestion worker...")
        repo_path = self.sync_repository()

        total_scanned = 0
        total_processed = 0
        batch_buffer = []

        logger.info("[GHSA] Traversing repository files...")

        for json_file in repo_path.glob("**/*.json"):
            if json_file.name in ["package.json", "package-lock.json"]:
                continue

            total_scanned += 1
            ghsa_id = json_file.stem

            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    payload = json.load(f)
            except Exception as read_err:
                logger.error(f"[GHSA] Failed to read {json_file.name}: {read_err}")
                continue

            external_id = payload.get("id") or ghsa_id

            # Safe Schema Check (Logs only ID and missing keys, NO RAW PAYLOAD DUMPS)
            missing = set(self.required_keys) - set(payload.keys())
            if missing:
                logger.warning(f"[GHSA] Schema warning [{external_id}]: Missing keys {missing}")
                continue

            batch_buffer.append(
                SourceAdvisory(
                    external_id=external_id,
                    source=self.source_name,
                    raw_payload=payload,
                )
            )

            # Flush batch every 1,000 records
            if len(batch_buffer) >= BATCH_SIZE:
                SourceAdvisory.objects.bulk_create(
                    batch_buffer, ignore_conflicts=True
                )
                total_processed += len(batch_buffer)
                logger.info(
                    f"[GHSA] Bulk-saved batch of {len(batch_buffer)} items | Scanned: {total_scanned:,}"
                )

                batch_buffer.clear()
                reset_queries()
                gc.collect()

        # Flush final remaining items
        if batch_buffer:
            SourceAdvisory.objects.bulk_create(batch_buffer, ignore_conflicts=True)
            total_processed += len(batch_buffer)
            logger.info(f"[GHSA] Final batch saved ({len(batch_buffer)} items).")
            batch_buffer.clear()

        reset_queries()
        gc.collect()

        logger.info(
            f"[GHSA] Finished successfully! Scanned: {total_scanned:,} | Processed: {total_processed:,}"
        )