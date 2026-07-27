# api/pagination.py

from rest_framework.pagination import PageNumberPagination


class VulnerabilityPagination(PageNumberPagination):
    """Custom pagination class for vulnerability list endpoint."""
    
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100