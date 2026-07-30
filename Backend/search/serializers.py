# search/serializers.py
import logging
from datetime import datetime

logger = logging.getLogger("ingestion_logger")


def sanitize_id(raw_id: str) -> str:
    """Sanitizes document ID to lowercase alphanumeric + hyphens/underscores."""
    clean_id = "".join(c if (c.isalnum() or c in ("-", "_")) else "_" for c in str(raw_id)).lower()
    return clean_id[:450]


def truncate_filter_value(val: str, max_bytes: int = 440) -> str:
    """Truncates filter array elements under LMDB 468 byte limit."""
    if not val:
        return ""
    encoded = str(val).encode("utf-8")
    if len(encoded) <= max_bytes:
        return str(val)
    return encoded[:max_bytes].decode("utf-8", errors="ignore")


def build_meilisearch_document(vulnerability_obj, advisories_map: dict = None) -> dict:
    """
    Transforms MasterVulnerability into a flattened Meilisearch JSON document.
    Uses advisories_map for O(1) in-memory lookup.
    """
    display_id = getattr(vulnerability_obj, "display_id", "") or str(vulnerability_obj.id)
    doc_id = sanitize_id(display_id)

    published_at_dt = getattr(vulnerability_obj, "published_at", None)
    if isinstance(published_at_dt, datetime):
        published_epoch = int(published_at_dt.timestamp())
    else:
        published_epoch = 0

    descriptions = []
    vendor_remediations = []

    # 1. Look up related advisories in O(1) time using batch advisories_map
    matching_advisories = []
    if advisories_map is not None:
        matching_advisories = advisories_map.get(display_id, [])

    for advisory in matching_advisories:
        payload = advisory.raw_payload or {}
        source_name = advisory.source or "unknown"

        desc_text = (
            payload.get("description")
            or payload.get("summary")
            or payload.get("details")
            or ""
        )
        if desc_text:
            descriptions.append({
                "source": str(source_name),
                "text": str(desc_text)
            })

        remediation_text = (
            payload.get("solution")
            or payload.get("remediation")
            or payload.get("mitigation")
            or ""
        )
        if remediation_text:
            vendor_remediations.append({
                "source": str(source_name),
                "text": str(remediation_text)
            })

    # 2. Process Vulnerability Tags (Table 3)
    filter_tech_names = set()
    filter_ecosystems = set()
    filter_comp_matrix = []
    vulnerable_components = []

    tags = vulnerability_obj.tags.all() if hasattr(vulnerability_obj, "tags") else []
    for tag in tags:
        tech = (tag.tech_name or "").strip()
        eco = (tag.ecosystem or "").strip()
        intro = (tag.introduced_version or "").strip()
        fixed = (tag.fixed_version or "").strip()
        raw_expr = (tag.raw_version_expression or "").strip() or f"{intro} -> {fixed}"

        if tech:
            filter_tech_names.add(truncate_filter_value(tech.lower()))
        if eco:
            filter_ecosystems.add(truncate_filter_value(eco.lower()))

        matrix_entry = f"{tech.lower()}|{eco.lower()}|{fixed.lower()}"
        filter_comp_matrix.append(truncate_filter_value(matrix_entry))

        vulnerable_components.append({
            "tech_name": str(tech),
            "ecosystem": str(eco),
            "introduced_version": str(intro),
            "fixed_version": str(fixed),
            "raw_version_expression": str(raw_expr)
        })

    # 3. Process Vulnerability References (Table 4)
    references = []
    if hasattr(vulnerability_obj, "references"):
        references = [ref.url for ref in vulnerability_obj.references.all() if ref.url]

    # Construct document blueprint
    document = {
        "id": doc_id,
        "display_id": str(display_id),
        "severity": str(getattr(vulnerability_obj, "severity", "UNKNOWN")).upper(),
        "published_at": published_epoch,
        "descriptions": descriptions,
        "vendor_remediations": vendor_remediations,
        "filter_tech_names": list(filter_tech_names),
        "filter_ecosystems": list(filter_ecosystems),
        "filter_comp_matrix": filter_comp_matrix,
        "vulnerable_components": vulnerable_components,
        "references": references,
    }

    return document