# api/urls.py

from django.urls import path
from .views import VulnerabilityListView, VulnerabilityDetailView

app_name = "api"

urlpatterns = [
    # List endpoint: GET /api/v1/vulnerabilities/
    path(
        "vulnerabilities/",
        VulnerabilityListView.as_view(),
        name="vulnerability-list",
    ),
    # Detail endpoint: GET /api/v1/vulnerabilities/CVE-2023-1234/
    path(
        "vulnerabilities/<str:display_id>/",
        VulnerabilityDetailView.as_view(),
        name="vulnerability-detail",
    ),
]