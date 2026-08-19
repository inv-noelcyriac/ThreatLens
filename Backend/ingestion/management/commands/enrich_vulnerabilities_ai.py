# ingestion/management/commands/enrich_vulnerabilities_ai.py

import logging
from datetime import timedelta
from django.utils import timezone
from django.core.management.base import BaseCommand
from django.db.models import Q, Exists, OuterRef
from ingestion.models import MasterVulnerability, VulnerabilityTag, SourceAdvisory
from ingestion.processors.ai_enrichment_service import AIEnrichmentService

logger = logging.getLogger("ingestion_logger")


class Command(BaseCommand):
    help = "Runs AI-assisted enrichment on MasterVulnerability records missing description or tags."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=50,
            help="Maximum number of un-enriched vulnerabilities to process in a single batch (default: 50).",
        )
        parser.add_argument(
            "--hours",
            type=int,
            default=None,
            help="Only process incoming records created within the last N hours (e.g. 24 for daily sync).",
        )

    def handle(self, *args, **options):
        limit = options["limit"]
        hours = options["hours"]
        self.stdout.write(self.style.NOTICE(f"Starting AI Vulnerability Enrichment batch (limit: {limit}, hours: {hours or 'ALL'})..."))

        # Find un-enriched candidate vulnerabilities efficiently
        candidates_checked = 0
        success_count = 0

        # Query active un-enriched records missing tags directly in DB (excluding hidden/rejected records)
        queryset = MasterVulnerability.objects.filter(is_ai_enriched=False, tags__isnull=True, is_hidden=False)
        if hours:
            cutoff = timezone.now() - timedelta(hours=hours)
            queryset = queryset.filter(created_at__gte=cutoff)

        cursor = queryset.order_by("-created_at").iterator(chunk_size=100)

        service = AIEnrichmentService()

        for vuln in cursor:
            if candidates_checked >= limit:
                break

            missing_fields, _ = service.detect_missing_fields(vuln)
            if not missing_fields:
                continue

            context_text = service.build_context(vuln)
            rej_keywords = ["rejected or withdrawn", "rejected reason", "** reject **", "issued in error"]
            if any(kw in context_text.lower() for kw in rej_keywords):
                continue

            candidates_checked += 1
            msg = f"[{candidates_checked}/{limit}] Processing candidate {vuln.display_id} (missing: {missing_fields})..."
            self.stdout.write(msg)
            self.stdout.flush()
            logger.info(msg)

            try:
                if service.enrich_vulnerability(vuln):
                    success_count += 1
                    s_msg = f" Successfully enriched {vuln.display_id}"
                    self.stdout.write(self.style.SUCCESS(s_msg))
                    self.stdout.flush()
                    logger.info(s_msg)
                else:
                    w_msg = f" Skipped/Rejected {vuln.display_id}"
                    self.stdout.write(self.style.WARNING(w_msg))
                    self.stdout.flush()
                    logger.info(w_msg)
            except Exception as e:
                logger.error(f"[CLI Enrichment Error] Failed for Vuln ID {vuln.id}: {str(e)}")

        done_msg = f"\nCompleted AI Enrichment Batch. Successfully enriched {success_count}/{candidates_checked} candidate(s)."
        self.stdout.write(self.style.SUCCESS(done_msg))
        logger.info(done_msg)