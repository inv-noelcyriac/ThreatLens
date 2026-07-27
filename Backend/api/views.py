from rest_framework import generics
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from ingestion.models import MasterVulnerability
from .serializers import MasterVulnerabilitySerializer
from .pagination import VulnerabilityPagination
from .filters import VulnerabilityFilter


class VulnerabilityListView(generics.ListAPIView):
    """
    GET /api/v1/vulnerabilities/
    Returns paginated list of vulnerabilities.
    """
    serializer_class = MasterVulnerabilitySerializer
    pagination_class = VulnerabilityPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = VulnerabilityFilter

    search_fields = ["display_id", "tags__tech_name"]
    ordering_fields = ["published_at", "severity"]
    ordering = ["-published_at"]

    def get_queryset(self):
        # Uses related_name='tags' and related_name='references' to optimize queries
        return MasterVulnerability.objects.prefetch_related(
            "tags", "references"
        ).all()


class VulnerabilityDetailView(generics.RetrieveAPIView):
    """
    GET /api/v1/vulnerabilities/<display_id>/
    Retrieves a single vulnerability by display_id.
    """
    serializer_class = MasterVulnerabilitySerializer
    lookup_field = "display_id"

    def get_queryset(self):
        return MasterVulnerability.objects.prefetch_related(
            "tags", "references"
        ).all()