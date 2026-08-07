# import logging

# from django.core.management.base import BaseCommand
# from django.db.models import F, Q

# from ingestion.models import SourceAdvisory
# from ingestion.parsers.parser_factory import ParserFactory
# from ingestion.processors.normalization_service import (
#     NormalizationService,
# )

# logger = logging.getLogger("ingestion_logger")


# class Command(BaseCommand):
#     """
#     Normalize raw advisories stored in source_advisories
#     into relational tables.

#     Examples
#     --------

#     Normalize everything:

#         python manage.py normalize_vault

#     Normalize only NVD:

#         python manage.py normalize_vault --source nvd

#     Process 1000 advisories per batch:

#         python manage.py normalize_vault --limit 1000
#     """

#     help = "Normalize raw advisories into relational tables."

#     def add_arguments(self, parser):

#         parser.add_argument(
#             "--source",
#             type=str,
#             help="Normalize advisories from one source only.",
#         )

#         parser.add_argument(
#             "--limit",
#             type=int,
#             default=500,
#             help="Batch size (default: 500).",
#         )

#     def handle(self, *args, **options):

#         batch_size = options["limit"]

#         success = 0
#         failed = 0

#         logger.info(
#             "[Normalizer] Starting normalization..."
#         )

#         last_id = 0

#         while True:

#             advisories = list(
#                 self._build_queryset(
#                     options,
#                     batch_size,
#                     last_id=last_id,
#                 )
#             )

#             #
#             # Nothing left to normalize.
#             #
#             if not advisories:
#                 break

#             logger.info(
#                 f"[Normalizer] Processing batch "
#                 f"({len(advisories)} advisories)..."
#             )

#             for advisory in advisories:

#                 try:

#                     self._process_advisory(
#                         advisory
#                     )

#                     success += 1

#                 except Exception:

#                     failed += 1

#                     logger.exception(
#                         "[Normalizer] Failed processing "
#                         f"{advisory.external_id}"
#                     )

#             last_id = advisories[-1].id

#         logger.info(
#             "[Normalizer] Completed. "
#             f"Success={success}, "
#             f"Failed={failed}"
#         )

#     # --------------------------------------------------
#     # Private Helpers
#     # --------------------------------------------------

#     def _build_queryset(
#         self,
#         options,
#         limit,
#         last_id=0,
#     ):

#         queryset = (
#             SourceAdvisory.objects
#             .filter(
#                 id__gt=last_id
#             )
#             .filter(
#                 Q(normalized_at__isnull=True)
#                 |
#                 Q(normalized_at__lt=F("fetched_at"))
#             )
#             .order_by("id")
#         )

#         source = options.get("source")

#         if source:

#             queryset = queryset.filter(
#                 source=source.lower()
#             )

#         return queryset[:limit]

#     # --------------------------------------------------

#     def _process_advisory(
#         self,
#         advisory: SourceAdvisory,
#     ):

#         parser = ParserFactory.get_parser(
#             advisory.source
#         )

#         normalized = parser.parse(
#             advisory
#         )

#         NormalizationService.normalize(
#             advisory,
#             normalized,
#         )

#         logger.info(
#             "[Normalizer] Successfully normalized "
#             f"{advisory.external_id}"
#         )
import logging

from django.core.management.base import BaseCommand
from django.db import reset_queries
from django.db.models import F, Q

from ingestion.models import SourceAdvisory
from ingestion.parsers.parser_factory import ParserFactory
from ingestion.processors.normalization_service import (
    NormalizationService,
)

logger = logging.getLogger("ingestion_logger")


class Command(BaseCommand):
    """
    Normalize raw advisories stored in source_advisories
    into relational tables.

    Examples
    --------

    Normalize everything:

        python manage.py normalize_vault

    Normalize only NVD:

        python manage.py normalize_vault --source nvd

    Process 1000 advisories per batch:

        python manage.py normalize_vault --limit 1000
    """

    help = "Normalize raw advisories into relational tables."

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

    def handle(self, *args, **options):
        batch_size = options["limit"]
        success = 0
        failed = 0

        logger.info("[Normalizer] Starting normalization...")

        last_id = 0

        while True:
            advisories = list(
                self._build_queryset(
                    options,
                    batch_size,
                    last_id=last_id,
                )
            )

            # Nothing left to normalize
            if not advisories:
                break

            logger.info(
                f"[Normalizer] Processing batch "
                f"({len(advisories)} advisories, cursor id > {last_id})..."
            )

            for advisory in advisories:
                try:
                    self._process_advisory(advisory)
                    success += 1
                except Exception:
                    failed += 1
                    logger.exception(
                        f"[Normalizer] Failed processing {advisory.external_id} "
                        f"(SourceAdvisory ID: {advisory.id})"
                    )

            # Advance cursor to highest ID in current batch
            last_id = advisories[-1].id
            reset_queries()

        logger.info(
            f"[Normalizer] Completed. Success={success}, Failed={failed}"
        )

    # --------------------------------------------------
    # Private Helpers
    # --------------------------------------------------

    def _build_queryset(
        self,
        options,
        limit,
        last_id=0,
    ):
        queryset = (
            SourceAdvisory.objects
            .filter(id__gt=last_id)
            .filter(
                Q(normalized_at__isnull=True)
                | Q(normalized_at__lt=F("fetched_at"))
            )
            .order_by("id")
        )

        source = options.get("source")
        if source:
            queryset = queryset.filter(source=source.lower())

        return queryset[:limit]

    # --------------------------------------------------

    def _process_advisory(
        self,
        advisory: SourceAdvisory,
    ):
        parser = ParserFactory.get_parser(advisory.source)
        normalized = parser.parse(advisory)

        NormalizationService.normalize(
            advisory,
            normalized,
        )

        logger.info(
            f"[Normalizer] Successfully normalized {advisory.external_id}"
        )