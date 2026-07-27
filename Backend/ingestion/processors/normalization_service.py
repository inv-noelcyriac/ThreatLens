import logging

from django.db import transaction
from django.utils import timezone

from ingestion.models import SourceAdvisory

from .master_service import MasterService
from .tag_service import TagService
from .reference_service import ReferenceService

logger = logging.getLogger("ingestion_logger")


class NormalizationService:
    """
    Orchestrates the complete normalization pipeline.

    Processing Contract:

    1. Everything executes inside ONE database transaction.

    2. If ANY operation fails,
       the entire transaction rolls back.

    3. normalized_at is updated ONLY after all
       relational tables are successfully written.
    """

    @staticmethod
    def normalize(
        advisory: SourceAdvisory,
        vulnerability,
    ) -> None:

        logger.info(
            f"[Normalization Service] Normalizing "
            f"'{advisory.external_id}'..."
        )

        with transaction.atomic():

            #
            # Step 1
            #
            master = MasterService.upsert(
                vulnerability
            )

            #
            # Step 2
            #
            TagService.sync(
                master,
                vulnerability.tags,
            )

            #
            # Step 3
            #
            ReferenceService.sync(
                master,
                vulnerability.references,
            )

            #
            # Step 4
            #
            advisory.normalized_at = timezone.now()

            advisory.save(
                update_fields=[
                    "normalized_at",
                ]
            )

        logger.info(
            f"[Normalization Service] "
            f"Successfully normalized "
            f"'{advisory.external_id}'."
        )