from unittest.mock import MagicMock, patch
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from django.utils import timezone

from ingestion.models import SourceAdvisory
from ingestion.parsers.normalized_models import NormalizedVulnerability


class RunWorkerCommandTestCase(TestCase):
    """Tests for the run_workers management command."""

    @patch("ingestion.management.commands.run_workers.GHSAGitTask")
    def test_run_worker_single_target_success(self, mock_ghsa_task):
        """Test running a specific worker feed successfully."""
        mock_ghsa_task.__name__ = "GHSAGitTask"
        mock_instance = MagicMock()
        mock_ghsa_task.return_value = mock_instance

        call_command("run_workers", "ghsa")

        mock_ghsa_task.assert_called_once()
        mock_instance.run.assert_called_once()

    def test_run_worker_invalid_choice_raises_error(self):
        """Test that passing an invalid worker name raises a CommandError."""
        with self.assertRaises(CommandError):
            call_command("run_workers", "invalid_worker")

    @patch("ingestion.management.commands.run_workers.GHSAGitTask")
    def test_run_worker_handles_worker_exception(self, mock_ghsa_task):
        """Test that worker exceptions are caught and logged without crashing."""
        mock_ghsa_task.__name__ = "GHSAGitTask"
        mock_instance = MagicMock()
        mock_instance.run.side_effect = Exception("API connection timeout")
        mock_ghsa_task.return_value = mock_instance

        call_command("run_workers", "ghsa")
        mock_instance.run.assert_called_once()


class NormalizeVaultCommandTestCase(TestCase):
    """Tests for the normalize_vault management command."""

    def setUp(self):
        self.adv1 = SourceAdvisory.objects.create(
            source="nvd",
            external_id="CVE-2026-1001",
            raw_payload={"id": "CVE-2026-1001"},
            normalized_at=None,
        )
        self.adv2 = SourceAdvisory.objects.create(
            source="ghsa",
            external_id="GHSA-2026-1002",
            raw_payload={"id": "GHSA-2026-1002"},
            normalized_at=None,
        )

    @patch("ingestion.management.commands.normalize_vault.NormalizationService")
    @patch("ingestion.management.commands.normalize_vault.ParserFactory")
    def test_normalize_vault_all_sources(self, mock_parser_factory, mock_normalization_service):
        mock_parser = MagicMock()
        mock_parser.parse.return_value = NormalizedVulnerability(
            display_id="CVE-2026-1001",
            severity="HIGH",
            published_at=timezone.now(),
        )
        mock_parser_factory.get_parser.return_value = mock_parser

        call_command("normalize_vault", limit=10)

        self.assertEqual(mock_normalization_service.normalize.call_count, 2)

    @patch("ingestion.management.commands.normalize_vault.NormalizationService")
    @patch("ingestion.management.commands.normalize_vault.ParserFactory")
    def test_normalize_vault_source_filter(self, mock_parser_factory, mock_normalization_service):
        mock_parser = MagicMock()
        mock_parser.parse.return_value = NormalizedVulnerability(
            display_id="CVE-2026-1001",
            severity="HIGH",
            published_at=timezone.now(),
        )
        mock_parser_factory.get_parser.return_value = mock_parser

        call_command("normalize_vault", source="nvd")

        self.assertEqual(mock_normalization_service.normalize.call_count, 1)
        mock_parser_factory.get_parser.assert_called_with("nvd")

    @patch("ingestion.management.commands.normalize_vault.NormalizationService")
    @patch("ingestion.management.commands.normalize_vault.ParserFactory")
    def test_normalize_vault_handles_parsing_exceptions(self, mock_parser_factory, mock_normalization_service):
        mock_parser = MagicMock()
        mock_parser.parse.side_effect = [
            Exception("Malformed JSON"),
            NormalizedVulnerability(display_id="GHSA-2026-1002", severity="LOW", published_at=timezone.now()),
        ]
        mock_parser_factory.get_parser.return_value = mock_parser

        call_command("normalize_vault")

        self.assertEqual(mock_normalization_service.normalize.call_count, 1)


class RunSchedulerCommandTestCase(TestCase):
    """Tests for the run_scheduler daily management command."""

    @patch("ingestion.management.commands.run_scheduler.BlockingScheduler")
    def test_scheduler_initializes_jobs_and_handles_shutdown(self, mock_scheduler_cls):
        mock_scheduler = MagicMock()
        mock_scheduler.start.side_effect = KeyboardInterrupt
        mock_scheduler_cls.return_value = mock_scheduler

        call_command("run_scheduler")

        mock_scheduler.add_jobstore.assert_called_once()

        job_ids = [call_kwargs[1]["id"] for call_kwargs in mock_scheduler.add_job.call_args_list]
        expected_ids = [
            "run_full_daily_pipeline",
            "delete_old_job_executions",
        ]

        for expected_id in expected_ids:
            self.assertIn(expected_id, job_ids)

        mock_scheduler.start.assert_called_once()
        mock_scheduler.shutdown.assert_called_once()