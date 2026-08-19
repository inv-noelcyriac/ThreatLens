from datetime import datetime, timezone
import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from ingestion.models import ManualRemediation, MasterVulnerability, RemediationVote

User = get_user_model()


# ==========================================
# FIXTURES
# ==========================================


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="testuser",
        email="testuser@example.com",
        password="password123",
        first_name="John",
        last_name="Doe",
    )


@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        username="otheruser",
        email="otheruser@example.com",
        password="password123",
        first_name="Jane",
        last_name="Smith",
    )


@pytest.fixture
def master_vuln(db):
    return MasterVulnerability.objects.create(
        display_id="CVE-2026-1234",
        severity="HIGH",
        published_at=datetime.now(timezone.utc),
        is_hidden=False,
        meilisearch_synced=True,
    )


@pytest.fixture
def remediation(db, master_vuln, user):
    return ManualRemediation.objects.create(
        master_vuln=master_vuln,
        user=user,
        guidance_text="Upgrade to version 2.0.1 or apply hotfix patch A.",
    )


# ==========================================
# REMEDIATION VIEWS TESTS
# ==========================================


@pytest.mark.django_db
class TestManualRemediationViews:

    def test_list_remediations(self, api_client, master_vuln, remediation):
        """Test retrieving list of manual remediations for a specific vulnerability."""
        url = reverse(
            "vulnerability-remediations",
            kwargs={"display_id": master_vuln.display_id},
        )
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        results = (
            response.data.get("results", response.data)
            if isinstance(response.data, dict)
            else response.data
        )
        assert len(results) >= 1

    def test_remediations_default_pagination(self, api_client, master_vuln, user):
        """Test default pagination limits response to 10 items and returns metadata."""
        remediations = [
            ManualRemediation(
                master_vuln=master_vuln,
                user=user,
                guidance_text=f"Guidance note #{i}",
            )
            for i in range(15)
        ]
        ManualRemediation.objects.bulk_create(remediations)

        url = reverse(
            "vulnerability-remediations",
            kwargs={"display_id": master_vuln.display_id},
        )
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert "count" in response.data
        assert response.data["count"] == 15
        assert len(response.data["results"]) == 10  # Default page size
        assert response.data["next"] is not None
        assert response.data["previous"] is None

    def test_remediations_pagination_page_two(self, api_client, master_vuln, user):
        """Test fetching second page returns remaining records and correct previous link."""
        remediations = [
            ManualRemediation(
                master_vuln=master_vuln,
                user=user,
                guidance_text=f"Guidance note #{i}",
            )
            for i in range(15)
        ]
        ManualRemediation.objects.bulk_create(remediations)

        url = reverse(
            "vulnerability-remediations",
            kwargs={"display_id": master_vuln.display_id},
        )
        response = api_client.get(f"{url}?page=2")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 15
        assert len(response.data["results"]) == 5  # Remaining items on page 2
        assert response.data["next"] is None
        assert response.data["previous"] is not None

    def test_remediations_custom_page_size(self, api_client, master_vuln, user):
        """Test frontend overriding page size using ?page_size parameter."""
        remediations = [
            ManualRemediation(
                master_vuln=master_vuln,
                user=user,
                guidance_text=f"Guidance note #{i}",
            )
            for i in range(15)
        ]
        ManualRemediation.objects.bulk_create(remediations)

        url = reverse(
            "vulnerability-remediations",
            kwargs={"display_id": master_vuln.display_id},
        )
        response = api_client.get(f"{url}?page_size=5")

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 5

    def test_remediations_invalid_page_number(self, api_client, master_vuln):
        """Test requesting a non-existent page returns HTTP 404."""
        url = reverse(
            "vulnerability-remediations",
            kwargs={"display_id": master_vuln.display_id},
        )
        response = api_client.get(f"{url}?page=999")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_create_remediation_authenticated(self, api_client, master_vuln, user):
        """Test authenticated user successfully adding a remediation note."""
        api_client.force_authenticate(user=user)
        url = reverse(
            "vulnerability-remediations",
            kwargs={"display_id": master_vuln.display_id},
        )
        payload = {"guidance_text": "Apply security patch release v1.4.0 immediately."}

        response = api_client.post(url, data=payload, format="json")

        assert response.status_code in [status.HTTP_201_CREATED, status.HTTP_200_OK]
        assert ManualRemediation.objects.filter(
            master_vuln=master_vuln, user=user
        ).exists()

    def test_create_remediation_unauthenticated(self, api_client, master_vuln):
        """Test unauthenticated user denied creating a remediation note."""
        url = reverse(
            "vulnerability-remediations",
            kwargs={"display_id": master_vuln.display_id},
        )
        payload = {"guidance_text": "Unauthorized attempt."}

        response = api_client.post(url, data=payload, format="json")

        assert response.status_code in [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        ]

    def test_update_own_remediation(self, api_client, remediation, user):
        """Test user updating their own remediation entry."""
        api_client.force_authenticate(user=user)
        url = reverse("remediation-detail", kwargs={"pk": remediation.id})
        payload = {"guidance_text": "Updated guidance: Upgrade to v2.0.2."}

        response = api_client.patch(url, data=payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        remediation.refresh_from_db()
        assert remediation.guidance_text == "Updated guidance: Upgrade to v2.0.2."

    def test_update_other_user_remediation_forbidden(
        self, api_client, remediation, other_user
    ):
        """Test user prohibited from updating someone else's remediation entry."""
        api_client.force_authenticate(user=other_user)
        url = reverse("remediation-detail", kwargs={"pk": remediation.id})
        payload = {"guidance_text": "Malicious edit attempt."}

        response = api_client.patch(url, data=payload, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_own_remediation(self, api_client, remediation, user):
        """Test user deleting their own remediation entry."""
        api_client.force_authenticate(user=user)
        url = reverse("remediation-detail", kwargs={"pk": remediation.id})

        response = api_client.delete(url)

        assert response.status_code in [
            status.HTTP_204_NO_CONTENT,
            status.HTTP_200_OK,
        ]
        assert not ManualRemediation.objects.filter(id=remediation.id).exists()


# ==========================================
# REMEDIATION VOTE VIEWS TESTS
# ==========================================


@pytest.mark.django_db
class TestRemediationVoteViews:

    def test_upvote_remediation(self, api_client, remediation, other_user):
        """Test upvoting a remediation note."""
        api_client.force_authenticate(user=other_user)
        url = reverse("remediation-vote", kwargs={"pk": remediation.id})
        payload = {"vote_type": RemediationVote.VoteChoices.UPVOTE.value}

        response = api_client.post(url, data=payload, format="json")

        assert response.status_code in [
            status.HTTP_201_CREATED,
            status.HTTP_200_OK,
        ], response.data
        assert RemediationVote.objects.filter(
            remediation=remediation,
            user=other_user,
            vote_type=RemediationVote.VoteChoices.UPVOTE,
        ).exists()

    def test_downvote_remediation(self, api_client, remediation, other_user):
        """Test downvoting a remediation note."""
        api_client.force_authenticate(user=other_user)
        url = reverse("remediation-vote", kwargs={"pk": remediation.id})
        payload = {"vote_type": RemediationVote.VoteChoices.DOWNVOTE.value}

        response = api_client.post(url, data=payload, format="json")

        assert response.status_code in [
            status.HTTP_201_CREATED,
            status.HTTP_200_OK,
        ], response.data
        assert RemediationVote.objects.filter(
            remediation=remediation,
            user=other_user,
            vote_type=RemediationVote.VoteChoices.DOWNVOTE,
        ).exists()

    def test_toggle_or_change_vote(self, api_client, remediation, other_user):
        """Test changing a vote from UPVOTE to DOWNVOTE."""
        RemediationVote.objects.create(
            remediation=remediation,
            user=other_user,
            vote_type=RemediationVote.VoteChoices.UPVOTE,
        )

        api_client.force_authenticate(user=other_user)
        url = reverse("remediation-vote", kwargs={"pk": remediation.id})
        payload = {"vote_type": RemediationVote.VoteChoices.DOWNVOTE.value}

        response = api_client.post(url, data=payload, format="json")

        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_201_CREATED,
        ], response.data
        vote = RemediationVote.objects.get(remediation=remediation, user=other_user)
        assert vote.vote_type == RemediationVote.VoteChoices.DOWNVOTE

    def test_unauthenticated_vote_rejected(self, api_client, remediation):
        """Test unauthenticated user cannot vote on remediation."""
        url = reverse("remediation-vote", kwargs={"pk": remediation.id})
        payload = {"vote_type": RemediationVote.VoteChoices.UPVOTE.value}

        response = api_client.post(url, data=payload, format="json")

        assert response.status_code in [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        ]