from unittest.mock import MagicMock, patch
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from meilisearch.errors import MeilisearchCommunicationError


class VulnerabilityAPITests(APITestCase):

    def setUp(self):
        # Ensure these names match the 'name=' parameter in your urls.py
        self.list_url = reverse('vulnerability-list')
        self.search_url = reverse('vulnerability-search')

        self.mock_meilisearch_response = {
            "hits": [
                {
                    "id": "CVE-2026-1001",
                    "severity": "MEDIUM",
                    "published_at": 1774915200
                }
            ],
            "totalHits": 1,
            "totalPages": 1,
            "processingTimeMs": 2
        }

    # FIXED: Updated import path from 'vulnerabilities' to 'search'
    @patch('search.views.get_meilisearch_client')
    def test_search_vulnerabilities_success(self, mock_client_func):
        mock_index = MagicMock()
        mock_index.search.return_value = self.mock_meilisearch_response
        mock_client_func.return_value.index.return_value = mock_index

        response = self.client.get(self.search_url, {
            'q': 'apache',
            'severity': 'medium',
            'start_date': '31-03-2026',
            'page': 1,
            'limit': 10
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['query'], 'apache')
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['published_at'], '31-03-2026')

    def test_invalid_pagination_parameters(self):
        response = self.client.get(self.search_url, {'page': 'invalid', 'limit': 'abc'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # FIXED: Updated import path from 'vulnerabilities' to 'search'
    @patch('search.views.get_meilisearch_client')
    def test_meilisearch_down_returns_503(self, mock_client_func):
        mock_client_func.side_effect = MeilisearchCommunicationError("Connection refused")

        response = self.client.get(self.search_url, {'q': 'test'})
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn('error', response.data)