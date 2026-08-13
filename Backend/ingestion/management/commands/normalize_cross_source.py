import logging
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import reset_queries
from django.db.models import F, Q

from ingestion.models import SourceAdvisory
from ingestion.parsers.parser_factory import ParserFactory
from ingestion.processors.cross_source_service import CrossSourceService

logger = logging.getLogger("ingestion_logger")


class Command(BaseCommand):
    """
    Perform multi-source vulnerability normalization with cross-source aggregation.

    Guarantees:
    - Combines tags/references across all source feeds (NVD, GHSA, OSV, AWS, Docker) for a given CVE.
    - Prevents data loss from last-write-wins overwrites.
    - Operates alongside existing normalize_vault command without breaking current backend.

    Examples
    --------
    Normalize everything:

        python manage.py normalize_cross_source

    Normalize only NVD:

        python manage.py normalize_cross_source --source nvd

    Process in batches of 500:

        python manage.py normalize_cross_source --limit 500
    """

    help = "Normalize raw advisories with cross-source deduplication & tag union."

    def add_arguments(self, parser):
        parser.add_argument(
            "--source",
            type=str,
            help="Normalize advisories from one source only.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=500,
            help="Batch size (default: 500).",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force re-normalization of already normalized advisories.",
        )

    def handle(self, *args, **options):
        batch_size = options["limit"]
        success = 0
        failed = 0

        logger.info("[Cross-Source Normalizer] Starting cross-source normalization...")

        last_id = 0

        while True:
            advisories = list(
                self._build_queryset(
                    options,
                    batch_size,
                    last_id=last_id,
                )
            )

            if not advisories:
                break

            logger.info(
                f"[Cross-Source Normalizer] Processing batch "
                f"({len(advisories)} advisories, cursor id > {last_id})..."
            )

            # Group advisories by canonical display_id (e.g. CVE ID or GHSA ID)
            grouped = defaultdict(list)

            for advisory in advisories:
                try:
                    parser = ParserFactory.get_parser(advisory.source)
                    parsed = parser.parse(advisory)
                    canonical_id = CrossSourceService.resolve_display_id(advisory, parsed)
                    grouped[canonical_id].append((advisory, parsed))
                except Exception:
                    failed += 1
                    logger.exception(
                        f"[Cross-Source Normalizer] Failed parsing advisory {advisory.external_id} "
                        f"(SourceAdvisory ID: {advisory.id})"
                    )

            # Process each display_id group
            for display_id, items in grouped.items():
                try:
                    CrossSourceService.normalize_group(display_id, items)
                    success += len(items)
                except Exception:
                    failed += len(items)
                    logger.exception(
                        f"[Cross-Source Normalizer] Failed normalizing group '{display_id}' "
                        f"({len(items)} record(s))"
                    )

            last_id = advisories[-1].id
            reset_queries()

        logger.info(
            f"[Cross-Source Normalizer] Completed. Success={success}, Failed={failed}"
        )

    def _build_queryset(
        self,
        options,
        limit,
        last_id=0,
    ):
        queryset = SourceAdvisory.objects.filter(id__gt=last_id)

        if not options.get("force"):
            queryset = queryset.filter(
                Q(normalized_at__isnull=True)
                | Q(normalized_at__lt=F("fetched_at"))
            )

        source = options.get("source")
        if source:
            queryset = queryset.filter(source=source.lower())

        return queryset[:limit]
