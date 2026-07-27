import django_filters
from ingestion.models import MasterVulnerability


class VulnerabilityFilter(django_filters.FilterSet):
    """Filter set for MasterVulnerability queries."""

    severity = django_filters.CharFilter(lookup_expr="iexact")
    tech_name = django_filters.CharFilter(
        field_name="tags__tech_name", lookup_expr="icontains"
    )
    ecosystem = django_filters.CharFilter(
        field_name="tags__ecosystem", lookup_expr="iexact"
    )

    class Meta:
        model = MasterVulnerability
        fields = ["severity", "tech_name", "ecosystem"]