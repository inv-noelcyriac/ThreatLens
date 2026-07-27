import logging

from ingestion.models import (
    MasterVulnerability,
    VulnerabilityTag,
)

from ingestion.parsers.normalized_models import (
    NormalizedTag,
)

logger = logging.getLogger("ingestion_logger")


class TagService:
    """
    Handles all operations related to the
    vulnerability_tags table.

    Responsibilities:
    - Idempotent tag upserts
    - One master vulnerability may have many tags
    """

    @staticmethod
    def sync(
        master: MasterVulnerability,
        tags: list[NormalizedTag],
    ) -> None:

        logger.info(
            f"[Tag Service] Processing {len(tags)} tag(s) "
            f"for '{master.display_id}'."
        )

        for tag in tags:

            try:

                obj, created = (
                    VulnerabilityTag.objects.update_or_create(
                        master_vuln=master,
                        tech_name=tag.tech_name or "unknown",
                        ecosystem=tag.ecosystem or "generic",
                        raw_version_expression=tag.raw_version_expression,
                        defaults={
                            "introduced_version": tag.introduced_version,
                            "fixed_version": tag.fixed_version,
                        },
                    )
                )

                if created:

                    logger.info(
                        "[Tag Service] Created tag "
                        f"'{tag.tech_name}'."
                    )

                else:

                    logger.info(
                        "[Tag Service] Updated tag "
                        f"'{tag.tech_name}'."
                    )

            except Exception:

                logger.exception(
                    "[Tag Service] Failed processing tag "
                    f"'{tag.tech_name}' "
                    f"for '{master.display_id}'."
                )

                raise