import logging
from datetime import datetime, timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from meilisearch.errors import (
    MeilisearchError,
    MeilisearchCommunicationError,
    MeilisearchApiError,
)
from search.meilisearch_client import INDEX_NAME, get_meilisearch_client

logger = logging.getLogger("ingestion_logger")

ALLOWED_SORT_FIELDS = {"published_at", "severity", "cvss_score"}


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


def parse_multi_value_param(request, param_name: str, uppercase: bool = False) -> list[str]:
    """Extracts query parameter values supporting both repeated keys and comma-separated strings.
    
    Examples:
      - ?severity=high&severity=medium -> ['high', 'medium']
      - ?severity=high,medium -> ['high', 'medium']
    """
    raw_list = request.GET.getlist(param_name)
    extracted_values = []
    for item in raw_list:
        if not item:
            continue
        # Split comma-separated inputs if present
        for val in item.split(","):
            cleaned = val.strip()
            if cleaned:
                extracted_values.append(cleaned.upper() if uppercase else cleaned)
    return extracted_values


def parse_sort_param(sort_input: str) -> str:
    """Validates and formats the sort query parameter.

    Handles both 'field:direction' (e.g. 'cvss_score:desc') and bare 'field'
    (e.g. 'cvss_score'). Defaults to 'published_at:desc' if an invalid
    attribute is provided.
    """
    if not sort_input:
        return "published_at:desc"

    sort_input = sort_input.strip()

    if ":" in sort_input:
        field, direction = sort_input.split(":", 1)
        field = field.strip()
        direction = direction.strip().lower()

        if field in ALLOWED_SORT_FIELDS and direction in {"asc", "desc"}:
            return f"{field}:{direction}"
    else:
        field = sort_input.strip()
        if field in ALLOWED_SORT_FIELDS:
            return f"{field}:desc"

    return "published_at:desc"


class MasterVulnerabilityListView(APIView):
    """GENERAL LIST API: GET /api/v1/vulnerabilities/

    Fetches vulnerability records from Meilisearch with dynamic pagination and sorting.
    """

    def get(self, request):
        limit, page, offset = get_pagination_params(request)
        if isinstance(offset, Response):
            return offset

        sort_param = parse_sort_param(
            request.GET.get("sort", "published_at:desc")
        )

        try:
            client = get_meilisearch_client()
            index = client.index(INDEX_NAME)

            raw_results = index.search(
                "",
                {
                    "page": page,
                    "hitsPerPage": limit,
                    "sort": [sort_param],
                    "filter": "is_hidden = false",  # <-- Guarantees soft-hidden items are omitted
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
                formatted_hits.append(formatted_hit)

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
    """SEARCH & FILTER API: GET /api/v1/vulnerabilities/search/

    Queries Meilisearch with support for keyword search, multi-field/multi-value filtering,
    date ranges, custom sorting, and dynamic pagination.
    """

    def get(self, request):
        limit, page, offset = get_pagination_params(request)
        if isinstance(offset, Response):
            return offset

        query = request.GET.get("q", "").strip()
        
        # Extract potential multi-value query parameters
        ecosystems = parse_multi_value_param(request, "ecosystem")
        tech_names = parse_multi_value_param(request, "tech_name")
        severities = parse_multi_value_param(request, "severity", uppercase=True)

        start_ts = parse_date_to_timestamp(
            request.GET.get("start_date", ""), end_of_day=False
        )
        end_ts = parse_date_to_timestamp(
            request.GET.get("end_date", ""), end_of_day=True
        )
        sort_param = parse_sort_param(
            request.GET.get("sort", "published_at:desc")
        )

        # Base filter mandatory for public queries
        filters = ["is_hidden = false"]
        
        if ecosystems:
            escaped_eco = [f"'{escape_filter_val(v)}'" for v in ecosystems]
            filters.append(f"filter_ecosystems IN [{', '.join(escaped_eco)}]")

        if tech_names:
            escaped_tech = [f"'{escape_filter_val(v)}'" for v in tech_names]
            filters.append(f"filter_tech_names IN [{', '.join(escaped_tech)}]")

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

        try:
            client = get_meilisearch_client()
            index = client.index(INDEX_NAME)

            search_params = {
                "page": page,
                "hitsPerPage": limit,
                "sort": [sort_param],
                "filter": filter_expression,  # Always includes 'is_hidden = false'
            }

            raw_results = index.search(query, search_params)

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
                formatted_hits.append(formatted_hit)

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