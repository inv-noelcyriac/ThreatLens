# search/sync_service.py
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


def resolve_source_name(display_id: str, provided_source: str | None) -> str:
    """
    Resolves and formats the source name cleanly.
    Uses provided_source if available, otherwise infers from display_id prefix.
    """
    if provided_source and str(provided_source).strip():
        src = str(provided_source).strip().lower()
        if "github" in src or "ghsa" in src:
            return "GitHub Advisory"
        elif "nvd" in src or "cve" in src:
            return "NVD"
        elif "osv" in src:
            return "OSV"
        return src.upper()

    display_id_upper = str(display_id).strip().upper()
    
    if display_id_upper.startswith("GHSA"):
        return "GitHub Advisory"
    elif display_id_upper.startswith("CVE"):
        return "NVD"
    elif display_id_upper.startswith("OSV"):
        return "OSV"
    
    return "UNKNOWN"


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

    # --- 1. Extract Descriptions ---
    # OSV / GHSA Format
    if raw_payload.get("details"):
        descriptions.append(str(raw_payload["details"]))
    elif raw_payload.get("summary"):
        descriptions.append(str(raw_payload["summary"]))

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

    # --- 2. Extract Vendor Remediations / Fix Info ---
    # Check if admin manually saved a vendor remediation note
    if raw_payload.get("custom_vendor_remediation"):
        remediations.append(str(raw_payload["custom_vendor_remediation"]))

    if "affected" in raw_payload and isinstance(raw_payload["affected"], list):
        for item in raw_payload["affected"]:
            if not isinstance(item, dict):
                continue
            ranges = item.get("ranges", [])
            if isinstance(ranges, list):
                for r in ranges:
                    if not isinstance(r, dict):
                        continue
                    events = r.get("events", [])
                    if isinstance(events, list):
                        for event in events:
                            if isinstance(event, dict) and "fixed" in event:
                                pkg_info = item.get("package", {})
                                pkg_name = pkg_info.get("name", "package") if isinstance(pkg_info, dict) else "package"
                                remediations.append(f"Upgrade {pkg_name} to fixed version: {event['fixed']}")

    return {
        "descriptions": list(dict.fromkeys(descriptions)),
        "vendor_remediations": list(dict.fromkeys(remediations)),
    }


def build_meilisearch_document(master_vuln: MasterVulnerability, advisory_map: dict) -> dict:
    """
    Builds a clean, JSON-serializable Meilisearch document including source name.
    """
    tags = list(master_vuln.tags.all())
    references = [str(ref.url) for ref in master_vuln.references.all() if ref.url]

    tech_names = list({
    BaseParser.normalize_tech_name(t.tech_name) 
    for t in tags 
    if t.tech_name
    })
    # Reuse BaseParser.normalize_ecosystem
    ecosystems = list({
        BaseParser.normalize_ecosystem(t.ecosystem) 
        for t in tags 
        if t.ecosystem
    })

    comp_matrix = [
    f"{BaseParser.normalize_tech_name(t.tech_name)}:{BaseParser.normalize_ecosystem(t.ecosystem)}:{t.raw_version_expression or ''}"
    for t in tags
    ]

    advisory_data = advisory_map.get(master_vuln.display_id, {})
    if isinstance(advisory_data, dict):
        raw_payload = advisory_data.get("raw_payload", {})
        raw_source = advisory_data.get("source")
    else:
        raw_payload = {}
        raw_source = None

    source_name = resolve_source_name(master_vuln.display_id, raw_source)
    parsed_extra = parse_raw_payload(raw_payload)

    # --- DAY-LEVEL TIMESTAMP TRUNCATION ---
    pub_timestamp = 0
    if master_vuln.published_at:
        dt = master_vuln.published_at
        day_only = dt.replace(hour=0, minute=0, second=0, microsecond=0)
        pub_timestamp = int(day_only.replace(tzinfo=timezone.utc).timestamp())

    # --- Compute Severity & CVSS Score ---
    sev_str = str(master_vuln.severity or "UNKNOWN").upper()
    sev_score = SEVERITY_WEIGHTS.get(sev_str, 0)
    cvss_score = extract_cvss_score(master_vuln, raw_payload)

    return {
        "id": str(master_vuln.id),
        "display_id": str(master_vuln.display_id),
        "source": source_name,
        "severity": sev_str,
        "severity_score": sev_score,  # Integer weight (4, 3, 2, 1, 0)
        "cvss_score": cvss_score,      # Float score (e.g. 9.8)
        "published_at": pub_timestamp, # Day-normalized UTC timestamp
        "is_hidden": master_vuln.is_hidden,
        "descriptions": parsed_extra["descriptions"],
        "vendor_remediations": parsed_extra["vendor_remediations"],
        "filter_tech_names": tech_names,
        "filter_ecosystems": ecosystems,
        "filter_comp_matrix": comp_matrix,
        "vulnerable_components": comp_matrix,
        "references": references,
    }


def _get_advisory_map_for_batch(batch) -> dict:
    """Helper to fetch raw advisories and source field for a given list/queryset of master records."""
    display_ids = [v.display_id for v in batch]
    advisories = SourceAdvisory.objects.filter(
        external_id__in=display_ids
    ).values("external_id", "raw_payload", "source")
    
    advisory_map = {}
    for a in advisories:
        ext_id = a["external_id"]
        if ext_id not in advisory_map or not advisory_map[ext_id].get("raw_payload"):
            advisory_map[ext_id] = {
                "raw_payload": a["raw_payload"],
                "source": a["source"],
            }
            
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