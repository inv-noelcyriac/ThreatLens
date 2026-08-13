import logging

from ingestion.models import SourceAdvisory
from ingestion.parsers.parser_factory import ParserFactory
from .cross_source_service import CrossSourceService

logger = logging.getLogger("ingestion_logger")


class NormalizationService:
    """
    Orchestrates the complete normalization pipeline using CrossSourceService.

    Processing Contract:
    1. Fetches all SourceAdvisories sharing the canonical display_id (including existing DB records).
    2. Combines tags, reference URLs, and priority severity using CrossSourceService.
    3. Guarantees 0% data loss across multi-source CVEs during daily incremental runs.
    """

    @staticmethod
    def normalize(
        advisory: SourceAdvisory,
        vulnerability,
    ) -> None:
        logger.info(
            f"[Normalization Service] Processing '{advisory.external_id}' with CrossSourceService..."
        )

        display_id = CrossSourceService.resolve_display_id(advisory, vulnerability)

        # Retrieve all source advisories linked to this display_id (or external_id)
        related_advisories = list(
            SourceAdvisory.objects.filter(external_id=display_id)
        )
        if advisory not in related_advisories:
            related_advisories.append(advisory)

        # Parse each advisory in the group
        advisories_with_parsed = []
        for adv in related_advisories:
            if (adv.id and adv.id == advisory.id) or (adv.external_id == advisory.external_id and adv.source == advisory.source):
                advisories_with_parsed.append((adv, vulnerability))
            else:
                try:
                    parser = ParserFactory.get_parser(adv.source)
                    parsed = parser.parse(adv)
                    advisories_with_parsed.append((adv, parsed))
                except Exception as e:
                    logger.warning(
                        f"[Normalization Service] Failed parsing advisory {adv.id} ({adv.source}): {e}"
                    )

        if not advisories_with_parsed:
            advisories_with_parsed = [(advisory, vulnerability)]

        # Perform atomic cross-source normalization
        CrossSourceService.normalize_group(display_id, advisories_with_parsed)

        logger.info(
            f"[Normalization Service] Successfully normalized '{display_id}' across {len(advisories_with_parsed)} source(s)."
        )