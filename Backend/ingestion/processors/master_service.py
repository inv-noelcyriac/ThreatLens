import logging

from django.db import IntegrityError
from django.utils import timezone

from ingestion.models import MasterVulnerability
from ingestion.parsers.normalized_models import (
    NormalizedVulnerability,
)

logger = logging.getLogger("ingestion_logger")


class MasterService:
    """
    Handles all operations related to the
    master_vulnerabilities table.

    Responsibilities:
    - Idempotent upsert
    - Update mutable fields
    - Return the master vulnerability instance
    """

    @staticmethod
    def upsert(
        vulnerability: NormalizedVulnerability,
    ) -> MasterVulnerability:

        logger.info(
            f"[Master Service] Processing '{vulnerability.display_id}'..."
        )

        display_id_val = vulnerability.display_id or "UNKNOWN"
        severity_val = vulnerability.severity or "UNKNOWN"
        published_at_val = vulnerability.published_at or timezone.now()

        try:

            master, created = (
                MasterVulnerability.objects.update_or_create(
                    display_id=display_id_val,
                    defaults={
                        "severity": severity_val,
                        "published_at": published_at_val,
                        "meilisearch_synced": False,
                    },
                )
            )

            if created:

                logger.info(
                    f"[Master Service] Created '{master.display_id}'."
                )

            else:

                logger.info(
                    f"[Master Service] Updated '{master.display_id}'."
                )

            return master

        except IntegrityError:

            logger.exception(
                "[Master Service] IntegrityError while "
                f"processing '{display_id_val}'."
            )

            raise

        except Exception:

            logger.exception(
                "[Master Service] Unexpected error while "
                f"processing '{display_id_val}'."
            )

            raise