import logging
from datetime import datetime
from django.db import transaction
from django.utils import timezone

from ingestion.models import (
    MasterVulnerability,
    SourceAdvisory,
    VulnerabilityTag,
    VulnerabilityReference,
)
from ingestion.parsers.normalized_models import (
    NormalizedVulnerability,
    NormalizedTag,
    NormalizedReference,
)

logger = logging.getLogger("ingestion_logger")

SEVERITY_SCORES = {
    "CRITICAL": 4,
    "HIGH": 3,
    "MEDIUM": 2,
    "LOW": 1,
    "UNKNOWN": 0,
}

SOURCE_PRIORITY = {
    "nvd": 5,
    "ghsa": 4,
    "osv": 3,
    "aws": 2,
    "docker_ecosystem": 1,
    "docker_hardened_osv": 1,
}


class CrossSourceService:
    """
    Orchestrates multi-source vulnerability aggregation and normalization.

    Guarantees:
    - Zero data loss: Tags and references across ALL source advisories for a display_id are combined (unionized).
    - Source Precedence & Highest Severity: Severity and published_at are resolved deterministically.
    - Vendor Precedence: Authoritative vendor updates overwrite AI-enriched placeholders.
    - Idempotency & Atomicity: All database operations for a CVE group execute inside an atomic transaction.
    """

    @classmethod
    def resolve_display_id(
        cls, advisory: SourceAdvisory, parsed: NormalizedVulnerability
    ) -> str:
        """
        Determines the canonical display_id for an advisory.
        If parser found a CVE alias or canonical display_id (e.g. GHSA pointing to CVE), use that.
        """
        return parsed.display_id or advisory.external_id

    @classmethod
    def normalize_group(
        cls,
        display_id: str,
        advisories_with_parsed: list[tuple[SourceAdvisory, NormalizedVulnerability]],
    ) -> MasterVulnerability:
        """
        Normalizes a group of source advisories associated with the same canonical display_id.
        Handles single records (len=1 fast path) and multi-source records (len>1 aggregation) seamlessly.
        """
        if not advisories_with_parsed:
            raise ValueError("advisories_with_parsed cannot be empty.")

        logger.info(
            f"[Cross-Source Service] Aggregating {len(advisories_with_parsed)} advisory record(s) for '{display_id}'..."
        )

        # 1. Resolve Best Severity
        best_severity = cls._resolve_severity(advisories_with_parsed)

        # 2. Resolve Earliest Published At
        earliest_published_at = cls._resolve_published_at(advisories_with_parsed)

        # 3. Resolve Best Description
        vendor_description = cls._resolve_description(advisories_with_parsed)

        # 4. Aggregate Tags (Union across all sources)
        aggregated_tags = cls._aggregate_tags(advisories_with_parsed)

        # 5. Aggregate References (Union across all sources)
        aggregated_references = cls._aggregate_references(advisories_with_parsed)

        now = timezone.now()

        with transaction.atomic():
            # Step A: Get or Create MasterVulnerability
            master, _ = MasterVulnerability.objects.get_or_create(
                display_id=display_id,
                defaults={
                    "severity": best_severity,
                    "published_at": earliest_published_at or now,
                    "meilisearch_synced": False,
                },
            )

            # Update core vendor metadata
            master.severity = best_severity
            master.published_at = earliest_published_at or now
            master.meilisearch_synced = False

            # Step B: Apply Vendor Description Overwrite Rule & Rejection Detection
            rej_keywords = ["rejected or withdrawn", "rejected reason", "** reject **", "issued in error"]
            if vendor_description:
                if any(kw in vendor_description.lower() for kw in rej_keywords):
                    master.is_hidden = True
                    master.is_ai_enriched = False
                else:
                    # If existing record was enriched by AI, replace AI description with vendor data
                    if master.is_ai_enriched and isinstance(master.ai_enriched_fields, dict):
                        master.ai_enriched_fields.pop("description", None)
                        if not master.ai_enriched_fields:
                            master.is_ai_enriched = False
                    
                    if hasattr(master, "description"):
                        master.description = vendor_description

            master.save()

            # Step C: Sync Aggregated Tags (Deduplicated Union + AI Tag Replacement)
            cls._sync_tags(master, aggregated_tags)

            # Step D: Sync Aggregated References (Deduplicated Union)
            cls._sync_references(master, aggregated_references)

            # Step E: Stamp normalized_at on all advisories in this group
            for advisory, _ in advisories_with_parsed:
                advisory.normalized_at = now
                advisory.save(update_fields=["normalized_at"])

        logger.info(
            f"[Cross-Source Service] Successfully normalized group '{display_id}' "
            f"({len(aggregated_tags)} unique tag(s), {len(aggregated_references)} reference(s))."
        )

        return master

    @classmethod
    def _resolve_severity(
        cls, advisories_with_parsed: list[tuple[SourceAdvisory, NormalizedVulnerability]]
    ) -> str:
        """
        Resolves the overall severity using:
        1. Highest numeric severity score (CRITICAL > HIGH > MEDIUM > LOW > UNKNOWN)
        2. Source precedence tie-breaker (NVD > GHSA > OSV > AWS > Docker)
        """
        best_sev = "UNKNOWN"
        best_score = -1
        best_src_rank = -1

        for advisory, parsed in advisories_with_parsed:
            sev = (parsed.severity or "UNKNOWN").upper()
            score = SEVERITY_SCORES.get(sev, 0)
            src_rank = SOURCE_PRIORITY.get(advisory.source.lower(), 0)

            if score > best_score:
                best_score = score
                best_sev = sev
                best_src_rank = src_rank
            elif score == best_score and src_rank > best_src_rank:
                best_sev = sev
                best_src_rank = src_rank

        return best_sev

    @classmethod
    def _resolve_published_at(
        cls, advisories_with_parsed: list[tuple[SourceAdvisory, NormalizedVulnerability]]
    ) -> datetime | None:
        """
        Finds the earliest valid published_at timestamp across all sources.
        """
        valid_dates = [
            parsed.published_at
            for _, parsed in advisories_with_parsed
            if parsed.published_at is not None
        ]
        return min(valid_dates) if valid_dates else None

    @classmethod
    def _resolve_description(
        cls, advisories_with_parsed: list[tuple[SourceAdvisory, NormalizedVulnerability]]
    ) -> str | None:
        """
        Resolves description from vendor advisories using source priority precedence.
        """
        best_desc = None
        best_src_rank = -1

        for advisory, parsed in advisories_with_parsed:
            desc = (parsed.description or "").strip() if hasattr(parsed, "description") else ""
            if not desc:
                continue

            src_rank = SOURCE_PRIORITY.get(advisory.source.lower(), 0)
            if src_rank > best_src_rank:
                best_src_rank = src_rank
                best_desc = desc

        return best_desc

    @classmethod
    def _aggregate_tags(
        cls, advisories_with_parsed: list[tuple[SourceAdvisory, NormalizedVulnerability]]
    ) -> list[NormalizedTag]:
        """
        Combines and deduplicates tags across all advisories for a display_id.
        Deduplication key: (tech_name, ecosystem, raw_version_expression)
        """
        seen = set()
        aggregated = []

        for _, parsed in advisories_with_parsed:
            for tag in parsed.tags:
                tech_clean = str(tag.tech_name or "unknown").strip().lower()
                eco_clean = str(tag.ecosystem or "generic").strip().lower()
                raw_expr = str(tag.raw_version_expression or "").strip()

                dedup_key = (tech_clean, eco_clean, raw_expr)
                if dedup_key not in seen:
                    seen.add(dedup_key)
                    aggregated.append(tag)

        return aggregated

    @classmethod
    def _aggregate_references(
        cls, advisories_with_parsed: list[tuple[SourceAdvisory, NormalizedVulnerability]]
    ) -> list[NormalizedReference]:
        """
        Combines and deduplicates reference URLs across all advisories for a display_id.
        """
        seen = set()
        aggregated = []

        for _, parsed in advisories_with_parsed:
            for ref in parsed.references:
                url_clean = str(ref.url or "").strip()
                if url_clean and url_clean not in seen:
                    seen.add(url_clean)
                    aggregated.append(ref)

        return aggregated

    @classmethod
    def _sync_tags(cls, master: MasterVulnerability, tags: list[NormalizedTag]) -> None:
        """
        Safely upserts tags for the MasterVulnerability.
        Replaces AI-enriched placeholder tags when authoritative vendor tags arrive.
        """
        if tags:
            # Authoritative vendor tags arrived: clear out any AI-enriched placeholder tags
            VulnerabilityTag.objects.filter(master_vuln=master, is_ai_enriched=True).delete()

        for tag in tags:
            tech_clean = str(tag.tech_name or "unknown").strip()[:99]
            eco_clean = str(tag.ecosystem or "generic").strip()[:99]
            intro_clean = str(tag.introduced_version).strip()[:99] if tag.introduced_version else None
            fixed_clean = str(tag.fixed_version).strip()[:99] if tag.fixed_version else None
            raw_expr_clean = str(tag.raw_version_expression).strip()[:500] if tag.raw_version_expression else None

            VulnerabilityTag.objects.update_or_create(
                master_vuln=master,
                tech_name=tech_clean,
                ecosystem=eco_clean,
                raw_version_expression=raw_expr_clean,
                defaults={
                    "introduced_version": intro_clean,
                    "fixed_version": fixed_clean,
                    "is_ai_enriched": False,  # Vendor-provided tags are authoritative
                },
            )

    @classmethod
    def _sync_references(cls, master: MasterVulnerability, references: list[NormalizedReference]) -> None:
        """
        Safely upserts reference URLs for the MasterVulnerability.
        """
        for ref in references:
            url_clean = str(ref.url or "").strip()
            if url_clean:
                VulnerabilityReference.objects.update_or_create(
                    master_vuln=master,
                    url=url_clean,
                )