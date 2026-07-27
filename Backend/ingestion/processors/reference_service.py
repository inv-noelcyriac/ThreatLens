import logging

from ingestion.models import (
    MasterVulnerability,
    VulnerabilityReference,
)

from ingestion.parsers.normalized_models import (
    NormalizedReference,
)

logger = logging.getLogger("ingestion_logger")


class ReferenceService:
    """
    Handles all operations related to the
    vulnerability_references table.

    Responsibilities:
    - Idempotent reference upserts
    - One master vulnerability may have many references
    """

    @staticmethod
    def sync(
        master: MasterVulnerability,
        references: list[NormalizedReference],
    ) -> None:

        logger.info(
            f"[Reference Service] Processing "
            f"{len(references)} reference(s) "
            f"for '{master.display_id}'."
        )

        for reference in references:

            try:

                obj, created = (
                    VulnerabilityReference.objects.update_or_create(
                        master_vuln=master,
                        url=reference.url,
                    )
                )

                if created:

                    logger.info(
                        "[Reference Service] Created reference "
                        f"'{reference.url}'."
                    )

                else:

                    logger.info(
                        "[Reference Service] Reference already exists "
                        f"'{reference.url}'."
                    )

            except Exception:

                logger.exception(
                    "[Reference Service] Failed processing "
                    f"reference '{reference.url}' "
                    f"for '{master.display_id}'."
                )

                raise