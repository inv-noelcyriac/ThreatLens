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