# ingestion/processors/ai_enrichment_service.py

import logging
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from ingestion.models import MasterVulnerability, VulnerabilityTag, SourceAdvisory
from ingestion.services.ai_provider import PrimaryGeneratorClient
from ingestion.services.ai_verifier import AIEnrichmentVerifier

logger = logging.getLogger("ingestion_logger")


class AIEnrichmentService:
    """
    Orchestrates missing field detection, AI candidate generation,
    dual-stage verification, and PostgreSQL record enrichment.
    """

    def __init__(self):
        self.generator = PrimaryGeneratorClient()
        self.verifier = AIEnrichmentVerifier()

    def build_context(self, vuln: MasterVulnerability) -> str:
        """Assembles public metadata context for AI processing."""
        context_parts = []
        
        if vuln.display_id:
            context_parts.append(f"Vulnerability ID: {vuln.display_id}")
        
        # Include description if available (truncated to max 3000 chars to avoid token limit errors on massive kernel patch notes)
        desc = self._get_description(vuln)
        if desc:
            clean_desc = desc.strip()
            if len(clean_desc) > 3000:
                clean_desc = clean_desc[:3000] + "... [truncated for brevity]"
            context_parts.append(f"Description: {clean_desc}")

        # Pull references if present
        refs = vuln.references.all() if hasattr(vuln, "references") else []
        if refs:
            ref_urls = [r.url for r in refs[:5] if hasattr(r, "url")]
            if ref_urls:
                context_parts.append(f"References: {', '.join(ref_urls)}")

        # Include existing tags for context
        tags = vuln.tags.all()
        if tags.exists():
            tag_info = [f"{t.tech_name} ({t.ecosystem})" for t in tags if getattr(t, "tech_name", None)]
            if tag_info:
                context_parts.append(f"Existing Tags: {', '.join(tag_info)}")

        return "\n".join(context_parts)

    def _get_linked_advisories(self, vuln: MasterVulnerability) -> list[SourceAdvisory]:
        """
        Finds associated SourceAdvisory records by display_id (CVE)
        or GHSA IDs extracted from references.
        """
        if not vuln.display_id:
            return []

        # 1. Direct match on external_id (indexed exact match)
        advisories = list(SourceAdvisory.objects.filter(external_id=vuln.display_id))
        if advisories:
            return advisories

        advisories = list(SourceAdvisory.objects.filter(external_id__iexact=vuln.display_id))
        if advisories:
            return advisories

        # 2. Extract CVE token from composite IDs (e.g., ROOT-OS-UBUNTU-2404-CVE-2024-27025)
        if "CVE-" in vuln.display_id.upper():
            idx = vuln.display_id.upper().find("CVE-")
            cve_token = vuln.display_id[idx:]
            advisories = list(SourceAdvisory.objects.filter(external_id__iexact=cve_token))
            if advisories:
                return advisories

        # 3. Extract GHSA IDs from reference URLs
        ghsa_ids = []
        refs = vuln.references.all() if hasattr(vuln, "references") else []
        for ref in refs:
            url = getattr(ref, "url", "") or ""
            if "GHSA-" in url:
                parts = url.rstrip("/").split("/")
                for part in parts:
                    if part.startswith("GHSA-"):
                        ghsa_ids.append(part)

        if ghsa_ids:
            advisories = list(SourceAdvisory.objects.filter(external_id__in=ghsa_ids))
            if advisories:
                return advisories

        return []

    def _get_description(self, vuln: MasterVulnerability) -> str:
        """Retrieves existing description text from associated SourceAdvisory payloads."""
        advisories = self._get_linked_advisories(vuln)
        for adv in advisories:
            # Check direct attribute if model has one
            if hasattr(adv, "description") and adv.description and adv.description.strip():
                return adv.description.strip()

            payload = adv.raw_payload or {}
            if isinstance(payload, dict):
                if payload.get("details"):
                    return str(payload["details"])
                if payload.get("summary"):
                    return str(payload["summary"])
                cve_node = payload.get("cve") or payload.get("CVE") or {}
                if isinstance(cve_node, dict) and "descriptions" in cve_node:
                    for d in cve_node.get("descriptions", []):
                        if isinstance(d, dict) and d.get("value"):
                            return str(d["value"])
                if "descriptions" in payload and isinstance(payload["descriptions"], list):
                    for d in payload["descriptions"]:
                        if isinstance(d, dict) and d.get("value"):
                            return str(d["value"])
        return ""

    def detect_missing_fields(self, vuln: MasterVulnerability) -> tuple[list, bool]:
        """
        Identifies missing target fields (description, tech_name, ecosystem).
        Returns (missing_fields_list, has_missing_tags).
        """
        missing = []
        existing_desc = self._get_description(vuln)
        if not existing_desc or not existing_desc.strip():
            missing.append("description")

        tags = vuln.tags.all()
        # Check if there is any complete tag with both tech_name and ecosystem populated
        has_complete_tag = any(bool(t.tech_name and t.tech_name.strip() and t.ecosystem and t.ecosystem.strip()) for t in tags)
        
        has_missing_tags = False
        if not has_complete_tag:
            has_missing_tags = True
            # Check if any tag has partial information we can build upon
            has_tech_name = any(bool(t.tech_name and t.tech_name.strip()) for t in tags)
            has_ecosystem = any(bool(t.ecosystem and t.ecosystem.strip()) for t in tags)

            if not has_tech_name:
                missing.append("tech_name")
            if not has_ecosystem:
                missing.append("ecosystem")

        return list(dict.fromkeys(missing)), has_missing_tags

    def enrich_vulnerability(self, vuln: MasterVulnerability) -> bool:
        """Processes a single MasterVulnerability record with granular step logging."""
        missing_fields, has_missing_tags = self.detect_missing_fields(vuln)
        
        if not missing_fields:
            logger.info(f"[{vuln.display_id}] Skipping - no missing fields detected.")
            return False

        logger.info(f"[{vuln.display_id}] Starting AI enrichment for missing fields: {missing_fields}")

        context_text = self.build_context(vuln)
        if not context_text.strip():
            logger.warning(f"[{vuln.display_id}] Insufficient context available for AI generation.")
            return False

        rej_keywords = ["rejected or withdrawn", "rejected reason", "** reject **", "issued in error"]
        if any(kw in context_text.lower() for kw in rej_keywords):
            logger.info(f"[{vuln.display_id}] Skipping AI enrichment for rejected/withdrawn CVE.")
            return False

        # Step 1: Candidate Generation via Stage 1 Model (Groq)
        logger.info(f"[{vuln.display_id}] Requesting candidates from Stage 1 Generator...")
        candidates = self.generator.generate_candidates(context_text, missing_fields)
        if not candidates:
            logger.warning(f"[{vuln.display_id}] Stage 1 Generator returned empty candidates.")
            return False

        logger.info(f"[{vuln.display_id}] Stage 1 Generator returned: {list(candidates.keys())}")

        # Step 2: Verification via Stage 2 Model (Mistral)
        logger.info(f"[{vuln.display_id}] Sending candidates to Stage 2 Verifier...")
        is_verified, verification_metadata = self.verifier.verify(context_text, candidates)
        
        if not is_verified:
            logger.warning(
                f"[{vuln.display_id}] [AI Enrichment Rejected] Reason: {verification_metadata.get('reasoning')}"
            )
            return False

        logger.info(f"[{vuln.display_id}] [AI Enrichment Verified] Grounded confidence: {verification_metadata.get('confidence', 1.0)}")

        # Step 3: Atomic Database Persistence
        try:
            with transaction.atomic():
                ai_fields_meta = dict(vuln.ai_enriched_fields or {})

                # Description update in SourceAdvisory (raw_payload + description column if present)
                if "description" in candidates and candidates["description"]:
                    raw_desc_val = candidates["description"]
                    if isinstance(raw_desc_val, dict):
                        new_desc = str(raw_desc_val.get("text", "") or raw_desc_val.get("value", "")).strip()
                    else:
                        new_desc = str(raw_desc_val).strip()

                    advisories = self._get_linked_advisories(vuln)
                    
                    for adv in advisories:
                        payload = dict(adv.raw_payload or {})
                        payload["details"] = new_desc
                        payload["description"] = new_desc
                        adv.raw_payload = payload
                        
                        update_fields = ["raw_payload"]
                        if hasattr(adv, "description"):
                            adv.description = new_desc
                            update_fields.append("description")
                            
                        adv.save(update_fields=update_fields)

                    # Update MasterVulnerability audit tracking metadata
                    ai_fields_meta["description"] = {
                        "text": new_desc,
                        "enriched_at": timezone.now().isoformat(),
                        "confidence": verification_metadata.get("confidence", 0.9),
                    }
                    vuln.is_ai_enriched = True

                # VulnerabilityTag creation / update
                tags = list(vuln.tags.all())
                existing_tech = next((t.tech_name.strip() for t in tags if t.tech_name and t.tech_name.strip()), "")
                existing_eco = next((t.ecosystem.strip().lower() for t in tags if t.ecosystem and t.ecosystem.strip()), "")

                tech_name = candidates.get("tech_name", existing_tech)
                ecosystem = candidates.get("ecosystem", existing_eco)

                if tech_name and ecosystem:
                    # Update existing incomplete tag if present, otherwise create a new tag
                    incomplete_tag = next((t for t in tags if not (t.tech_name and t.ecosystem)), None)
                    if incomplete_tag:
                        incomplete_tag.tech_name = str(tech_name).strip()
                        incomplete_tag.ecosystem = str(ecosystem).strip().lower()
                        incomplete_tag.is_ai_enriched = True
                        incomplete_tag.save(update_fields=["tech_name", "ecosystem", "is_ai_enriched"])
                    else:
                        # Ensure we do not create duplicate tags
                        tag_exists = VulnerabilityTag.objects.filter(
                            master_vuln=vuln,
                            tech_name=str(tech_name).strip(),
                            ecosystem=str(ecosystem).strip().lower()
                        ).exists()
                        if not tag_exists:
                            VulnerabilityTag.objects.create(
                                master_vuln=vuln,
                                tech_name=str(tech_name).strip(),
                                ecosystem=str(ecosystem).strip().lower(),
                                is_ai_enriched=True,
                            )

                    # Update MasterVulnerability audit tracking metadata for tags
                    ai_fields_meta["tech_name"] = {
                        "value": str(tech_name).strip(),
                        "enriched_at": timezone.now().isoformat(),
                        "confidence": verification_metadata.get("confidence", 0.9),
                    }
                    ai_fields_meta["ecosystem"] = {
                        "value": str(ecosystem).strip().lower(),
                        "enriched_at": timezone.now().isoformat(),
                        "confidence": verification_metadata.get("confidence", 0.9),
                    }
                    vuln.is_ai_enriched = True

                # Reset Meilisearch sync flag to trigger index re-sync
                if hasattr(vuln, "meilisearch_synced"):
                    vuln.meilisearch_synced = False

                vuln.ai_enriched_fields = ai_fields_meta

                # Save all updated MasterVulnerability fields cleanly in one operation
                update_fields = ["ai_enriched_fields", "is_ai_enriched"]
                if hasattr(vuln, "meilisearch_synced"):
                    update_fields.append("meilisearch_synced")

                vuln.save(update_fields=update_fields)

            logger.info(f"[{vuln.display_id}] ✓ [AI Enrichment Success] Saved to DB & marked for Meilisearch re-sync.")
            return True

        except Exception as e:
            logger.error(f"[{vuln.display_id}] ✗ [AI Enrichment DB Error] Failed saving record: {str(e)}", exc_info=True)
            return False