import json
import logging
from datetime import timezone
from django.db.models import QuerySet
from ingestion.models import MasterVulnerability, SourceAdvisory
from search.meilisearch_client import get_meilisearch_client, INDEX_NAME
from ingestion.parsers.base_parser import BaseParser  # Adjust import path if needed

logger = logging.getLogger("ingestion_logger")

SEVERITY_WEIGHTS = {
    "CRITICAL": 4,
    "HIGH": 3,
    "MEDIUM": 2,
    "LOW": 1,
    "UNKNOWN": 0
}


# Display-friendly label mapping (ordered by priority)
_SOURCE_LABELS = [
    ("nvd",                 "NVD"),
    ("ghsa",                "GitHub Advisory"),
    ("github",              "GitHub Advisory"),
    ("osv",                 "OSV"),
    ("aws",                 "AWS"),
    ("docker_ecosystem",    "Docker"),
    ("docker_hardened_osv", "Docker Hardened"),
]

# Source priority order for sorting the displayed labels
_SOURCE_PRIORITY = {
    "nvd": 6,
    "ghsa": 5,
    "github": 4,
    "osv": 3,
    "aws": 2,
    "docker_ecosystem": 1,
    "docker_hardened_osv": 1,
}


def _format_single_source(raw: str) -> str:
    """Maps a raw source string to a human-readable label."""
    raw_lower = raw.strip().lower()
    for key, label in _SOURCE_LABELS:
        if key in raw_lower:
            return label
    return raw.strip().upper()


def resolve_source_name(display_id: str, sources: list[str] | str | None) -> str:
    """
    Resolves a human-readable, combined source label from one or more source strings.

    - Single source  → e.g. "NVD"
    - Multi source   → e.g. "NVD · OSV · Docker"  (sorted by priority, deduplicated)
    - Fallback       → infer from display_id prefix if no sources provided
    """
    raw_list = []
    if isinstance(sources, list):
        raw_list = [s for s in sources if s and str(s).strip()]
    elif sources and str(sources).strip():
        raw_list = [str(sources).strip()]

    if not raw_list:
        # Infer from display_id prefix
        display_id_upper = str(display_id).strip().upper()
        if display_id_upper.startswith("GHSA"):
            return "GitHub Advisory"
        elif display_id_upper.startswith("CVE"):
            return "NVD"
        elif display_id_upper.startswith("OSV"):
            return "OSV"
        return "Unknown"

    # Map each raw source → display label, deduplicate while preserving order
    seen_labels = set()
    labeled = []
    for raw in raw_list:
        label = _format_single_source(raw)
        if label not in seen_labels:
            seen_labels.add(label)
            labeled.append((raw.strip().lower(), label))

    # Sort by priority (highest first)
    labeled.sort(key=lambda x: _SOURCE_PRIORITY.get(x[0], 0), reverse=True)

    return " · ".join(label for _, label in labeled)


def extract_cvss_score(master_vuln: MasterVulnerability, raw_payload: dict) -> float:
    """Extracts numeric CVSS score accurately matching PostgreSQL / UI values."""
    
    # 1. ALWAYS check the Django DB model first if the field exists!
    for attr in ['cvss_score', 'cvss_v3_score', 'base_score', 'score']:
        if hasattr(master_vuln, attr):
            val = getattr(master_vuln, attr)
            if val is not None:
                try:
                    return float(val)
                except (ValueError, TypeError):
                    pass

    if not isinstance(raw_payload, dict):
        return 0.0

    # 2. Check NVD Format (Prioritize CVSS V3.1 / V3.0 OVER V2!)
    cve_node = raw_payload.get("cve") or raw_payload.get("CVE") or {}
    if isinstance(cve_node, dict):
        metrics = cve_node.get("metrics", {})
        if isinstance(metrics, dict):
            # Order matters: check V3.1 first, then V3.0, then V4.0, then V2
            for key in ["cvssMetricV31", "cvssMetricV30", "cvssMetricV40", "cvssMetricV2"]:
                metric_list = metrics.get(key, [])
                if isinstance(metric_list, list) and len(metric_list) > 0:
                    cvss_data = metric_list[0].get("cvssData", {})
                    if isinstance(cvss_data, dict) and "baseScore" in cvss_data:
                        try:
                            return float(cvss_data["baseScore"])
                        except (ValueError, TypeError):
                            pass

    # 3. Check OSV / GHSA format
    severity_items = raw_payload.get("severity", [])
    if isinstance(severity_items, list):
        for item in severity_items:
            if isinstance(item, dict) and "score" in item:
                try:
                    return float(item["score"])
                except (ValueError, TypeError):
                    pass

    return 0.0


def parse_raw_payload(raw_payload) -> dict:
    """
    Extracts descriptions, vendor remediations, and other missing attributes
    from source advisory raw JSON payloads (handles NVD, OSV, GHSA formats).
    """
    descriptions = []
    remediations = []

    # Handle stringified JSON from Postgres if applicable
    if isinstance(raw_payload, str):
        try:
            raw_payload = json.loads(raw_payload)
        except Exception:
            raw_payload = {}

    if not isinstance(raw_payload, dict):
        return {"descriptions": descriptions, "vendor_remediations": remediations}

    # OSV / GHSA / AWS Format
    if raw_payload.get("details"):
        descriptions.append(str(raw_payload["details"]))
    elif raw_payload.get("summary"):
        descriptions.append(str(raw_payload["summary"]))
    elif raw_payload.get("description") and isinstance(raw_payload["description"], str):
        descriptions.append(str(raw_payload["description"]))

    # NVD CVE Format (handles both 'cve' and 'CVE' keys)
    cve_node = raw_payload.get("cve") or raw_payload.get("CVE") or {}
    if isinstance(cve_node, dict) and "descriptions" in cve_node:
        for d in cve_node.get("descriptions", []):
            if isinstance(d, dict) and d.get("value"):
                descriptions.append(str(d["value"]))
    elif "descriptions" in raw_payload and isinstance(raw_payload["descriptions"], list):
        for d in raw_payload["descriptions"]:
            if isinstance(d, dict) and d.get("value"):
                descriptions.append(str(d["value"]))

    return {
        "descriptions": list(dict.fromkeys(descriptions)),
        "vendor_remediations": list(dict.fromkeys(remediations)),
    }


def build_meilisearch_document(master_vuln: MasterVulnerability, advisory_map: dict) -> dict:
    tags = list(master_vuln.tags.all())
    references = [str(ref.url) for ref in master_vuln.references.all() if ref.url]

    advisory_data = advisory_map.get(master_vuln.display_id, {})
    raw_payload = advisory_data.get("raw_payload", {}) if isinstance(advisory_data, dict) else {}
    # Collect all sources (list) for combined label; fall back to legacy "source" key
    raw_sources = (
        advisory_data.get("sources")
        or ([advisory_data["source"]] if advisory_data.get("source") else None)
        if isinstance(advisory_data, dict)
        else None
    )

    # Fallback to raw_payload parsing if DB tags are missing
    if not tags and raw_payload:
        cve_node = raw_payload.get("cve") or raw_payload.get("CVE") or {}
        affected_list = []
        if isinstance(cve_node, dict) and "affected" in cve_node:
            affected_list = cve_node.get("affected", [])
        elif "affected" in raw_payload and isinstance(raw_payload["affected"], list):
            affected_list = raw_payload["affected"]

        if affected_list:
            tags = BaseParser.extract_tags_from_affected(affected_list)

    # Clean Tech Names (Components)
    tech_names = list({
        BaseParser.normalize_tech_name(t.tech_name) 
        for t in tags 
        if t.tech_name and not str(t.tech_name).upper().startswith("CVE-")
    })

    # Clean Ecosystems
    ecosystems = list({
        BaseParser.normalize_ecosystem(t.ecosystem) 
        for t in tags 
        if t.ecosystem
    })

    # Build structured component entries (never allow display_id as component name)
    comp_matrix = []
    affected_components = []

    for t in tags:
        # Extract real package/tech name
        comp_name = t.tech_name if (t.tech_name and not str(t.tech_name).upper().startswith("CVE-")) else "Unknown Component"
        norm_tech = BaseParser.normalize_tech_name(comp_name)
        norm_eco = BaseParser.normalize_ecosystem(t.ecosystem)
        ver_expr = t.raw_version_expression or "See references"

        comp_matrix.append(f"{norm_tech}:{norm_eco}:{ver_expr}")

        # Structured dict format for easy UI table consumption
        affected_components.append({
            "component": comp_name,
            "ecosystem": norm_eco,
            "affected_versions": ver_expr,
            "status": "VULNERABLE"
        })

    source_name = resolve_source_name(master_vuln.display_id, raw_sources)
    parsed_extra = parse_raw_payload(raw_payload)

    # --- DAY-LEVEL TIMESTAMP TRUNCATION ---
    pub_timestamp = 0
    if master_vuln.published_at:
        dt = master_vuln.published_at
        day_only = dt.replace(hour=0, minute=0, second=0, microsecond=0)
        pub_timestamp = int(day_only.replace(tzinfo=timezone.utc).timestamp())

    sev_str = str(master_vuln.severity or "UNKNOWN").upper()
    sev_score = SEVERITY_WEIGHTS.get(sev_str, 0)
    cvss_score = extract_cvss_score(master_vuln, raw_payload)

    return {
        "id": str(master_vuln.id),
        "display_id": str(master_vuln.display_id),
        "source": source_name,
        "severity": sev_str,
        "severity_score": sev_score,
        "cvss_score": cvss_score,
        "published_at": pub_timestamp,
        "is_hidden": master_vuln.is_hidden,
        "descriptions": parsed_extra["descriptions"],
        "vendor_remediations": parsed_extra["vendor_remediations"],
        "filter_tech_names": tech_names if tech_names else ["Unknown Component"],
        "filter_ecosystems": ecosystems if ecosystems else ["General"],
        "filter_comp_matrix": comp_matrix,
        "vulnerable_components": comp_matrix,
        "affected_components": affected_components,  # Explicit structured dict for table
        "references": references,
    }


def _get_advisory_map_for_batch(batch) -> dict:
    """
    Fetches raw advisories for a batch of master records.
    Collects ALL sources per display_id to support multi-source labeling in the UI.
    The raw_payload of the highest-priority source is used for description/CVSS extraction.
    """
    display_ids = [v.display_id for v in batch]
    advisories = list(
        SourceAdvisory.objects.filter(external_id__in=display_ids)
        .values("external_id", "raw_payload", "source")
    )

    advisory_map = {}
    for a in advisories:
        ext_id = a["external_id"]
        if ext_id not in advisory_map:
            advisory_map[ext_id] = {
                "raw_payload": a["raw_payload"],
                "sources": [a["source"]],
            }
        else:
            # Accumulate all sources for this display_id
            advisory_map[ext_id]["sources"].append(a["source"])

            # Keep the highest-priority source's raw_payload for description/CVSS parsing
            existing_priority = _SOURCE_PRIORITY.get(
                advisory_map[ext_id]["sources"][0].lower(), 0
            )
            new_priority = _SOURCE_PRIORITY.get(a["source"].lower(), 0)
            if new_priority > existing_priority:
                advisory_map[ext_id]["raw_payload"] = a["raw_payload"]

    return advisory_map


def sync_single_vulnerability(master_vuln: MasterVulnerability) -> bool:
    """
    Syncs a single MasterVulnerability (e.g. from Django Admin save_related).
    """
    try:
        advisory_map = _get_advisory_map_for_batch([master_vuln])
        doc = build_meilisearch_document(master_vuln, advisory_map)

        client = get_meilisearch_client()
        client.index(INDEX_NAME).add_documents([doc])

        MasterVulnerability.objects.filter(id=master_vuln.id).update(meilisearch_synced=True)
        logger.info(f"[MEILISEARCH SYNC] Successfully synced {master_vuln.display_id}")
        return True

    except Exception as e:
        logger.error(f"[MEILISEARCH SYNC ERROR] Failed to sync {master_vuln.display_id}: {e}", exc_info=True)
        MasterVulnerability.objects.filter(id=master_vuln.id).update(meilisearch_synced=False)
        return False


def sync_queryset_batch(queryset: QuerySet) -> bool:
    """
    Syncs a list/QuerySet of MasterVulnerabilities (e.g. from Admin actions).
    """
    try:
        items = list(queryset.prefetch_related("tags", "references"))
        if not items:
            return True

        advisory_map = _get_advisory_map_for_batch(items)
        docs = [build_meilisearch_document(item, advisory_map) for item in items]

        client = get_meilisearch_client()
        client.index(INDEX_NAME).add_documents(docs)

        item_ids = [item.id for item in items]
        MasterVulnerability.objects.filter(id__in=item_ids).update(meilisearch_synced=True)
        logger.info(f"[MEILISEARCH SYNC] Successfully synced batch of {len(items)} record(s).")
        return True

    except Exception as e:
        logger.error(f"[MEILISEARCH SYNC ERROR] Batch sync failed: {e}", exc_info=True)
        item_ids = [item.id for item in items]
        MasterVulnerability.objects.filter(id__in=item_ids).update(meilisearch_synced=False)
        return False


def run_meilisearch_batch_sync(master_vuln_model, batch_size=1000):
    """
    Existing management command handler for bulk indexing unsynced records.
    """
    try:
        client = get_meilisearch_client()
        index = client.index(INDEX_NAME)

        total_unsynced = master_vuln_model.objects.filter(meilisearch_synced=False).count()
        if total_unsynced == 0:
            return "NO_UNSYNCED_RECORDS"

        logger.info(f"Starting sync for {total_unsynced} unsynced records...")
        processed_count = 0

        while True:
            batch = list(
                master_vuln_model.objects.filter(meilisearch_synced=False)
                .prefetch_related("tags", "references")[:batch_size]
            )

            if not batch:
                break

            advisory_map = _get_advisory_map_for_batch(batch)
            documents = [build_meilisearch_document(vuln, advisory_map) for vuln in batch]
            documents = [doc for doc in documents if doc and isinstance(doc, dict)]

            if documents:
                index.add_documents(documents)

            batch_ids = [v.id for v in batch]
            updated_rows = master_vuln_model.objects.filter(id__in=batch_ids).update(meilisearch_synced=True)

            if updated_rows == 0:
                logger.error("[MEILISEARCH SYNC] Batch update affected 0 rows. Aborting to prevent infinite loop.")
                break

            processed_count += len(batch)
            logger.info(f"Synced {processed_count}/{total_unsynced} records to Meilisearch.")

        return "SUCCESS"

    except Exception as e:
        logger.error(f"[MEILISEARCH SYNC ERROR] {str(e)}", exc_info=True)
        return "FAILED"


def delete_single_vulnerability(vulnerability_id: str) -> bool:
    """
    Deletes a document from the Meilisearch index by its UUID string.
    """
    try:
        client = get_meilisearch_client()
        client.index(INDEX_NAME).delete_document(str(vulnerability_id))
        logger.info(f"[MEILISEARCH SYNC] Deleted document {vulnerability_id} from Meilisearch.")
        return True
    except Exception as e:
        logger.error(
            f"[MEILISEARCH DELETE ERROR] Failed to delete document {vulnerability_id}: {e}",
            exc_info=True,
        )
        return False