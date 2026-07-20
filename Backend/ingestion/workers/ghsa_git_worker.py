import os
import json
import logging
import subprocess
from django.conf import settings
from ingestion.tasks import BaseIngestionTask

logger = logging.getLogger('ingestion_logger')

class GHSAGitTask(BaseIngestionTask):
    """
    [STREAM 2] Ingestion worker that clones/pulls the official GitHub Security Advisory (GHSA)
    database and vaults the raw, unprocessed JSON payloads directly into the database.
    """
    source_name: str = 'ghsa_git'

    def sync_repository(self, repo_url: str, repo_dir: str):
        """
        Clones the repo if it doesn't exist, otherwise pulls the latest changes.
        """
        parent_dir = os.path.dirname(repo_dir)
        if not os.path.exists(parent_dir):
            os.makedirs(parent_dir, exist_ok=True)

        if not os.path.exists(os.path.join(repo_dir, '.git')):
            logger.info(f"[{self.source_name.upper()}] Cloning GHSA repository for the first time...")
            subprocess.run(
                ["git", "clone", "--depth", "1", repo_url, repo_dir],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE
            )
        else:
            logger.info(f"[{self.source_name.upper()}] GHSA repository exists. Pulling latest updates...")
            subprocess.run(
                ["git", "-C", repo_dir, "pull"],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE
            )

    def run(self):
        logger.info(f"[{self.source_name.upper()}] Starting GHSA Git ingestion task...")
        
        repo_url = os.environ.get('GHSA_REPO_URL')
        if not repo_url:
            logger.error(f"[{self.source_name.upper()}] GHSA_REPO_URL environment variable is missing.")
            return

        # Determine target repository directory context dynamically and safely
        repo_dir = getattr(settings, 'GHSA_REPO_DIR', None)
        if not repo_dir:
            repo_dir = os.path.join(str(settings.BASE_DIR), 'data', 'ghsa_repo')

        try:
            # 1. Ensure local mirror is up to date
            self.sync_repository(repo_url=repo_url, repo_dir=repo_dir)
            
            total_vaulted = 0

            # 2. Walk directories and find all advisory json files
            logger.info(f"[{self.source_name.upper()}] Scanning directories for raw payloads...")
            for root, _, files in os.walk(repo_dir):
                if '.git' in root:
                    continue
                    
                for file in files:
                    if file.endswith('.json'):
                        file_path = os.path.join(root, file)
                        
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                raw_payload = json.load(f)
                            
                            external_id = raw_payload.get('id', '').strip()
                            if not external_id:
                                continue
                            
                            # 3. Save directly to the vault
                            self.save_advisory(external_id=external_id, raw_payload=raw_payload)
                            total_vaulted += 1
                            
                        except Exception as file_err:
                            logger.error(f"[{self.source_name.upper()}] Failed to read file {file}: {str(file_err)}")
                            continue
            
            logger.info(f"[{self.source_name.upper()}] GHSA Git ingestion completed. Vaulted {total_vaulted} raw advisories.")
            
        except Exception as e:
            logger.error(f"[{self.source_name.upper()}] PIPELINE CRASHED: {str(e)}")