# search/sync_service.py
import json
import logging
from django.db.models import QuerySet
from ingestion.models import MasterVulnerability, SourceAdvisory
from search.meilisearch_client import get_meilisearch_client, INDEX_NAME

logger = logging.getLogger("ingestion_logger")


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
    Builds a clean, JSON-serializable Meilisearch document.
    """
    tags = list(master_vuln.tags.all())
    references = [str(ref.url) for ref in master_vuln.references.all() if ref.url]

    tech_names = list({str(t.tech_name) for t in tags if t.tech_name})
    ecosystems = list({str(t.ecosystem) for t in tags if t.ecosystem})

    comp_matrix = [
        f"{t.tech_name or ''}:{t.ecosystem or ''}:{t.raw_version_expression or ''}"
        for t in tags
    ]

    raw_payload = advisory_map.get(master_vuln.display_id, {})
    parsed_extra = parse_raw_payload(raw_payload)

    pub_timestamp = 0
    if master_vuln.published_at:
        pub_timestamp = int(master_vuln.published_at.timestamp())

    return {
        "id": str(master_vuln.id),
        "display_id": str(master_vuln.display_id),
        "severity": str(master_vuln.severity or "UNKNOWN"),
        "published_at": pub_timestamp,
        "is_hidden": master_vuln.is_hidden,  # <-- Added soft-hide status
        "descriptions": parsed_extra["descriptions"],
        "vendor_remediations": parsed_extra["vendor_remediations"],
        "filter_tech_names": tech_names,
        "filter_ecosystems": ecosystems,
        "filter_comp_matrix": comp_matrix,
        "vulnerable_components": comp_matrix,
        "references": references,
    }


def _get_advisory_map_for_batch(batch) -> dict:
    """Helper to fetch raw advisories for a given list/queryset of master records."""
    display_ids = [v.display_id for v in batch]
    advisories = SourceAdvisory.objects.filter(
        external_id__in=display_ids
    ).values("external_id", "raw_payload")
    
    advisory_map = {}
    for a in advisories:
        ext_id = a["external_id"]
        if ext_id not in advisory_map or not advisory_map[ext_id]:
            advisory_map[ext_id] = a["raw_payload"]
            
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