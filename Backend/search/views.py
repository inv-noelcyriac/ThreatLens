import logging
from datetime import datetime, timezone
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from meilisearch.errors import (
    MeilisearchError,
    MeilisearchCommunicationError,
    MeilisearchApiError,
)

from ingestion.models import MasterVulnerability
from search.meilisearch_client import INDEX_NAME, get_meilisearch_client

logger = logging.getLogger("ingestion_logger")

ALLOWED_SORT_FIELDS = {"published_at", "severity", "severity_score", "cvss_score"}


def parse_date_to_timestamp(date_str: str, end_of_day: bool = False) -> int | None:
    """Parses 'DD-MM-YYYY' or 'YYYY-MM-DD' into a UTC UNIX timestamp (integer).

    Sets 00:00:00 for start_date and 23:59:59.999999 for end_date.
    """
    if not date_str:
        return None

    date_str = date_str.strip()
    dt = None

    # Try DD-MM-YYYY first (UI preference)
    try:
        dt = datetime.strptime(date_str, "%d-%m-%Y")
    except ValueError:
        pass

    # Fallback to YYYY-MM-DD
    if not dt:
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            return None

    if end_of_day:
        dt = dt.replace(hour=23, minute=59, second=59, microsecond=999999)
    else:
        dt = dt.replace(hour=0, minute=0, second=0, microsecond=0)

    return int(dt.replace(tzinfo=timezone.utc).timestamp())


def format_timestamp(ts: int | float | None, fmt: str = "%d-%m-%Y") -> str | None:
    """Converts a UNIX timestamp integer to a formatted date string.

    Default format: DD-MM-YYYY (e.g., 28-07-2026) Use fmt="%Y-%m-%d" for ISO format.
    """
    if ts is None:
        return None
    try:
        return datetime.fromtimestamp(ts, tz=timezone.utc).strftime(fmt)
    except Exception:
        return None


def get_pagination_params(request):
    """Helper to extract and validate limit & page parameters."""
    try:
        limit = int(request.GET.get("limit", 20))
        page = int(request.GET.get("page", 1))
    except ValueError:
        return None, None, Response(
            {
                "error": (
                    "Invalid pagination parameters ('limit' and 'page' must be"
                    " integers)."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    limit = min(max(1, limit), 100)  # Safe bounds: 1 to 100 items per page
    page = max(1, page)
    offset = (page - 1) * limit
    return limit, page, offset


def build_pagination_urls(request, page, limit, has_next, has_previous):
    """Helper to construct full next and previous URLs preserving query params."""
    base_url = request.build_absolute_uri(request.path)
    query_params = request.GET.copy()
    query_params["limit"] = str(limit)

    next_page = None
    if has_next:
        query_params["page"] = str(page + 1)
        next_page = f"{base_url}?{query_params.urlencode()}"

    previous_page = None
    if has_previous:
        query_params["page"] = str(page - 1)
        previous_page = f"{base_url}?{query_params.urlencode()}"

    return next_page, previous_page


def escape_filter_val(value: str) -> str:
    """Escapes single quotes for Meilisearch filter string syntax."""
    return value.replace("'", "''")


# Fields kept in list/search responses (dashboard card view).
_LIST_FIELDS = {
    "display_id",
    "severity",
    "descriptions",
    "cvss_score",
    "published_at",
    "source",
    "filter_ecosystems",
    "vendor_remediations",
}


def slim_hit(hit: dict) -> dict:
    """Returns only the fields required by the dashboard list card.

    Heavy fields (references, affected_components, filter_comp_matrix,
    vulnerable_components, filter_tech_names, severity_score, id, …)
    are intentionally excluded to keep the payload small.
    """
    return {k: v for k, v in hit.items() if k in _LIST_FIELDS}


def parse_multi_value_param(request, param_name: str, uppercase: bool = False) -> list[str]:
    """Extracts query parameter values supporting both repeated keys and comma-separated strings."""
    raw_list = request.GET.getlist(param_name)
    extracted_values = []
    for item in raw_list:
        if not item:
            continue
        for val in item.split(","):
            cleaned = val.strip()
            if cleaned:
                extracted_values.append(cleaned.upper() if uppercase else cleaned)
    return extracted_values


def parse_sort_params(sort_input: str) -> list[str]:
    """Returns sort array for Meilisearch.

    When severity_score is the primary grouper, cvss_score:desc is appended
    as a secondary tiebreaker so that within each severity bucket (e.g. all
    MEDIUM items), records are ordered from highest to lowest CVSS score.
    """
    default_sort = ["published_at:desc", "severity_score:desc", "cvss_score:desc"]

    if not sort_input:
        return default_sort

    sort_input = sort_input.strip()

    if ":" in sort_input:
        field, direction = sort_input.split(":", 1)
        field = field.strip()
        direction = direction.strip().lower()

        if direction not in {"asc", "desc"}:
            direction = "desc"

        if field == "published_at":
            # Secondary: severity bucket, tertiary: CVSS score within bucket
            return [f"published_at:{direction}", "severity_score:desc", "cvss_score:desc"]
        elif field == "severity_score":
            # Within each severity bucket, break ties by CVSS score
            return [f"severity_score:{direction}", "cvss_score:desc"]
        elif field in ALLOWED_SORT_FIELDS:
            # User explicitly chose cvss_score or another field as primary — respect it
            return [f"{field}:{direction}"]
    else:
        field = sort_input.strip()
        if field == "published_at":
            return ["published_at:desc", "severity_score:desc", "cvss_score:desc"]
        elif field == "severity_score":
            return ["severity_score:desc", "cvss_score:desc"]
        elif field in ALLOWED_SORT_FIELDS:
            return [f"{field}:desc"]

    return default_sort


class MasterVulnerabilityListView(APIView):
    """GENERAL LIST API: GET /api/v1/vulnerabilities/"""

    def get(self, request):
        limit, page, offset = get_pagination_params(request)
        if isinstance(offset, Response):
            return offset

        raw_sort_param = request.GET.get("sort", "published_at:desc")
        sort_params = parse_sort_params(raw_sort_param)

        try:
            client = get_meilisearch_client()
            index = client.index(INDEX_NAME)

            raw_results = index.search(
                "",
                {
                    "page": page,
                    "hitsPerPage": limit,
                    "sort": sort_params,
                    "filter": "NOT is_hidden = true",
                },
            )

            total_hits = raw_results.get(
                "totalHits", raw_results.get("estimatedTotalHits", 0)
            )
            total_pages = raw_results.get(
                "totalPages",
                (total_hits + limit - 1) // limit if total_hits > 0 else 1,
            )

            has_next = page < total_pages
            has_previous = page > 1

            next_page, previous_page = build_pagination_urls(
                request, page, limit, has_next, has_previous
            )

            raw_hits = raw_results.get("hits", [])
            formatted_hits = []
            for hit in raw_hits:
                formatted_hit = hit.copy()
                if isinstance(formatted_hit.get("published_at"), (int, float)):
                    formatted_hit["published_at"] = format_timestamp(
                        formatted_hit["published_at"], fmt="%d-%m-%Y"
                    )
                formatted_hits.append(slim_hit(formatted_hit))

            return Response(
                {
                    "results": formatted_hits,
                    "pagination": {
                        "total_records": total_hits,
                        "current_page": page,
                        "page_size": limit,
                        "total_pages": total_pages,
                        "has_next": has_next,
                        "has_previous": has_previous,
                        "next_page": next_page,
                        "previous_page": previous_page,
                    },
                    "processing_time_ms": raw_results.get(
                        "processingTimeMs", 0
                    ),
                },
                status=status.HTTP_200_OK,
            )

        except MeilisearchCommunicationError as e:
            logger.error(f"[MEILISEARCH CONNECTION ERROR] {str(e)}")
            return Response(
                {"error": "Search engine is temporarily unavailable. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except MeilisearchApiError as e:
            logger.error(f"[MEILISEARCH API ERROR] {str(e)}")
            return Response(
                {"error": "Invalid search parameters or query syntax error."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except MeilisearchError as e:
            logger.error(f"[MEILISEARCH GENERAL ERROR] {str(e)}")
            return Response(
                {"error": "Search service error encountered."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except Exception as e:
            logger.error(f"[MEILISEARCH LIST API ERROR] {str(e)}", exc_info=True)
            return Response(
                {"error": "An error occurred while fetching vulnerability records."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class VulnerabilitySearchView(APIView):
    """SEARCH & FILTER API: GET /api/v1/vulnerabilities/search/"""

    def get(self, request):
        limit, page, offset = get_pagination_params(request)
        if isinstance(offset, Response):
            return offset

        query = request.GET.get("q", "").strip()
        
        ecosystems = parse_multi_value_param(request, "ecosystem")
        tech_names = parse_multi_value_param(request, "tech_name")
        severities = parse_multi_value_param(request, "severity", uppercase=True)

        start_ts = parse_date_to_timestamp(
            request.GET.get("start_date", ""), end_of_day=False
        )
        end_ts = parse_date_to_timestamp(
            request.GET.get("end_date", ""), end_of_day=True
        )
        
        raw_sort_param = request.GET.get("sort", "published_at:desc")
        sort_params = parse_sort_params(raw_sort_param)

        filters = ["NOT is_hidden = true"]
        
        if ecosystems:
            escaped_eco = [f"'{escape_filter_val(v)}'" for v in ecosystems]
            filters.append(f"filter_ecosystems IN [{', '.join(escaped_eco)}]")

        if tech_names:
            tech_sub_clauses = []
            for t in tech_names:
                escaped_t = escape_filter_val(t.lower())
                tech_sub_clauses.append(
                    f'(filter_tech_names = \'{escaped_t}\' OR filter_tech_names STARTS WITH \'{escaped_t}-\')'
                )
            
            if len(tech_sub_clauses) == 1:
                filters.append(tech_sub_clauses[0])
            else:
                filters.append(f"({' OR '.join(tech_sub_clauses)})")

        if severities:
            escaped_sev = [f"'{escape_filter_val(v)}'" for v in severities]
            filters.append(f"severity IN [{', '.join(escaped_sev)}]")

        if start_ts is not None and end_ts is not None:
            filters.append(
                f"published_at >= {start_ts} AND published_at <= {end_ts}"
            )
        elif start_ts is not None:
            filters.append(f"published_at >= {start_ts}")
        elif end_ts is not None:
            filters.append(f"published_at <= {end_ts}")

        filter_expression = " AND ".join(filters)

        formatted_query = query
        if query:
            if query.startswith(".") or any(char in query for char in ["-", "/", "@", "+", "#"]):
                if not (query.startswith('"') and query.endswith('"')):
                    formatted_query = f'"{query}"'

        try:
            client = get_meilisearch_client()
            index = client.index(INDEX_NAME)

            search_params = {
                "page": page,
                "hitsPerPage": limit,
                "sort": sort_params,
                "filter": filter_expression,
            }

            raw_results = index.search(formatted_query, search_params)

            total_hits = raw_results.get(
                "totalHits", raw_results.get("estimatedTotalHits", 0)
            )
            total_pages = raw_results.get(
                "totalPages",
                (total_hits + limit - 1) // limit if total_hits > 0 else 1,
            )

            has_next = page < total_pages
            has_previous = page > 1

            next_page, previous_page = build_pagination_urls(
                request, page, limit, has_next, has_previous
            )

            raw_hits = raw_results.get("hits", [])
            formatted_hits = []

            for hit in raw_hits:
                formatted_hit = hit.copy()
                if isinstance(formatted_hit.get("published_at"), (int, float)):
                    formatted_hit["published_at"] = format_timestamp(
                        formatted_hit["published_at"], fmt="%d-%m-%Y"
                    )
                formatted_hits.append(slim_hit(formatted_hit))

            return Response(
                {
                    "query": query,
                    "results": formatted_hits,
                    "pagination": {
                        "total_records": total_hits,
                        "current_page": page,
                        "page_size": limit,
                        "total_pages": total_pages,
                        "has_next": has_next,
                        "has_previous": has_previous,
                        "next_page": next_page,
                        "previous_page": previous_page,
                    },
                    "processing_time_ms": raw_results.get(
                        "processingTimeMs", 0
                    ),
                },
                status=status.HTTP_200_OK,
            )

        except MeilisearchCommunicationError as e:
            logger.error(f"[MEILISEARCH CONNECTION ERROR] {str(e)}")
            return Response(
                {"error": "Search engine is temporarily unavailable. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except MeilisearchApiError as e:
            logger.error(f"[MEILISEARCH API ERROR] {str(e)}")
            return Response(
                {"error": "Invalid search parameters or query syntax error."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except MeilisearchError as e:
            logger.error(f"[MEILISEARCH GENERAL ERROR] {str(e)}")
            return Response(
                {"error": "Search service error encountered."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except Exception as e:
            logger.error(f"[MEILISEARCH SEARCH API ERROR] {str(e)}", exc_info=True)
            return Response(
                {"error": "An error occurred while executing the search request."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class MasterVulnerabilityDetailView(APIView):
    """DETAIL API: GET /api/v1/vulnerabilities/<display_id>/

    Returns complete vulnerability data for the side-panel modal.
    First searches Meilisearch for the exact hit, falls back to Postgres if needed.
    """

    def get(self, request, display_id):
        display_id_clean = display_id.strip()

        # 1. Fetch rich document directly from Meilisearch
        try:
            client = get_meilisearch_client()
            index = client.index(INDEX_NAME)

            # Perform standard search query on display_id (avoids unindexed filter errors)
            raw_results = index.search(display_id_clean, {"limit": 10})
            hits = raw_results.get("hits", [])

            selected_hit = None
            for hit in hits:
                hit_display = str(hit.get("display_id", "")).strip().lower()
                hit_cve = str(hit.get("cve_id", "")).strip().lower()
                hit_id = str(hit.get("id", "")).strip().lower()

                if display_id_clean.lower() in (hit_display, hit_cve, hit_id):
                    selected_hit = hit
                    break

            if selected_hit:
                hit_data = selected_hit.copy()

                # Ensure ecosystem is populated (fallback to filter_ecosystems if empty)
                if not hit_data.get("ecosystem"):
                    ecosystems = hit_data.get("filter_ecosystems", [])
                    if ecosystems and isinstance(ecosystems, list):
                        hit_data["ecosystem"] = ecosystems[0]

                # Normalise remediation fields for the frontend modal
                remediation_val = (
                    hit_data.get("official_remediation")
                    or hit_data.get("remediation")
                    or hit_data.get("remediation_guidance")
                    or ""
                )
                hit_data["official_remediation"] = remediation_val
                hit_data["remediation"] = remediation_val

                # Format published_at timestamp if numeric UNIX timestamp
                if isinstance(hit_data.get("published_at"), (int, float)):
                    hit_data["published_at"] = format_timestamp(
                        hit_data["published_at"], fmt="%d-%m-%Y"
                    )

                return Response(hit_data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.warning(f"[MEILISEARCH DETAIL SEARCH ERROR] {e}")

        # 2. Postgres DB Fallback
        vuln = get_object_or_404(
            MasterVulnerability.objects.prefetch_related("tags", "references"),
            display_id=display_id_clean,
            is_hidden=False,
        )

        tags_data = [
            {
                "tech_name": tag.tech_name,
                "ecosystem": tag.ecosystem,
                "introduced_version": getattr(tag, "introduced_version", ""),
                "fixed_version": getattr(tag, "fixed_version", ""),
                "raw_version_expression": getattr(tag, "raw_version_expression", ""),
            }
            for tag in vuln.tags.all()
        ]

        affected_components = [
            {
                "component": tag.tech_name,
                "affected_versions": getattr(tag, "raw_version_expression", "") or f"<{getattr(tag, 'fixed_version', '')}",
                "instance": tag.ecosystem,
                "status": "VULNERABLE",
            }
            for tag in vuln.tags.all()
        ]

        references_list = []
        for ref in vuln.references.all():
            url = getattr(ref, "url", str(ref))
            domain = url.split("//")[-1].split("/")[0] if "://" in url else url
            references_list.append({
                "url": url,
                "name": getattr(ref, "name", domain) or domain
            })

        remediation_text = (
            getattr(vuln, "official_remediation", "")
            or getattr(vuln, "remediation", "")
            or getattr(vuln, "remediation_guidance", "")
            or ""
        )

        ecosystem_val = getattr(vuln, "ecosystem", "")
        if not ecosystem_val and vuln.tags.exists():
            ecosystem_val = vuln.tags.first().ecosystem

        published_formatted = (
            vuln.published_at.strftime("%d-%m-%Y")
            if getattr(vuln, "published_at", None)
            else None
        )

        full_data = {
            "id": str(vuln.id),
            "display_id": vuln.display_id,
            "cve_id": getattr(vuln, "cve_id", vuln.display_id),
            "title": getattr(vuln, "title", vuln.display_id),
            "description": getattr(vuln, "description", ""),
            "severity": getattr(vuln, "severity", "UNKNOWN"),
            "severity_score": getattr(vuln, "severity_score", 0),
            "cvss_score": getattr(vuln, "cvss_score", getattr(vuln, "severity_score", 0)),
            "ecosystem": ecosystem_val,
            "official_remediation": remediation_text,
            "remediation": remediation_text,
            "source": getattr(vuln, "source", "NVD"),
            "published_at": published_formatted,
            "tags": tags_data,
            "affected_components": affected_components,
            "references": references_list,
            "is_hidden": vuln.is_hidden,
        }

        return Response(full_data, status=status.HTTP_200_OK)