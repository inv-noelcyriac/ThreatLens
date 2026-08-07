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

        # Clean up stale tags for this vulnerability before inserting updated tags
        master.tags.all().delete()

        for tag in tags:
            tech_clean = str(tag.tech_name or "unknown").strip()[:99]
            eco_clean = str(tag.ecosystem or "generic").strip()[:99]
            intro_clean = str(tag.introduced_version).strip()[:99] if tag.introduced_version else None
            fixed_clean = str(tag.fixed_version).strip()[:99] if tag.fixed_version else None
            raw_expr_clean = str(tag.raw_version_expression).strip()[:500] if tag.raw_version_expression else None

            try:

                obj, created = (
                    VulnerabilityTag.objects.update_or_create(
                        master_vuln=master,
                        tech_name=tech_clean,
                        ecosystem=eco_clean,
                        raw_version_expression=raw_expr_clean,
                        defaults={
                            "introduced_version": intro_clean,
                            "fixed_version": fixed_clean,
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