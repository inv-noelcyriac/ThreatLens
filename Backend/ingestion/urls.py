from django.urls import path
from .views import (
    RemediationListCreateView,
    RemediationDetailView,
    RemediationVoteView
)

urlpatterns = [
    # Fetch all notes / Post a new note for a specific vulnerability
    path(
        'vulnerabilities/<str:display_id>/remediations/',
        RemediationListCreateView.as_view(),
        name='vulnerability-remediations'
    ),
    # Edit / Delete an individual note by ID
    path(
        'remediations/<int:pk>/',
        RemediationDetailView.as_view(),
        name='remediation-detail'
    ),
    # Upvote / Downvote a specific note by ID
    path(
        'remediations/<int:pk>/vote/',
        RemediationVoteView.as_view(),
        name='remediation-vote'
    ),
]