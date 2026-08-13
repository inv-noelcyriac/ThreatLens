# search/urls.py
from django.urls import path
from search.views import MasterVulnerabilityListView, VulnerabilitySearchView, MasterVulnerabilityDetailView
urlpatterns = [
    # General list view from Meilisearch: /api/v1/vulnerabilities/
    path("vulnerabilities/", MasterVulnerabilityListView.as_view(), name="vulnerability-list"),
    
    # Search & multi-filter view from Meilisearch: /api/v1/vulnerabilities/search/
    path("vulnerabilities/search/", VulnerabilitySearchView.as_view(), name="vulnerability-search"),
     
    # Single Vulnerability Detail View: /api/v1/vulnerabilities/<display_id>/
    path("vulnerabilities/<str:display_id>/", MasterVulnerabilityDetailView.as_view(), name="vulnerability-detail"),
    
]