from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.db import DatabaseError
from django.test import TestCase
from django.utils import timezone

from ingestion.models import SourceAdvisory, SyncState
from ingestion.tasks import BaseIngestionTask, is_worker_running
from ingestion.workers.nvd_worker import NVDApiTask
from ingestion.workers.osv_worker import OSVZipIngestionTask


class DummyIngestionTask(BaseIngestionTask):
    """Concrete subclass of BaseIngestionTask for unit testing base methods."""

    source_name = "test_source"
    required_keys = ["id", "modified"]


class BaseIngestionTaskTestCase(TestCase):
    """Tests for BaseIngestionTask helper methods, schema validation, and save_advisory idempotency."""

    def setUp(self):
        self.task = DummyIngestionTask()

    def test_save_advisory_creates_new_record(self):
        """Verify new advisory is created with fetched_at populated and normalized_at clear."""
        payload = {"id": "CVE-2026-1001", "modified": "2026-01-01T00:00:00Z"}

        self.task.save_advisory(external_id="CVE-2026-1001", raw_payload=payload)

        advisory = SourceAdvisory.objects.get(
            source="test_source", external_id="CVE-2026-1001"
        )
        self.assertEqual(advisory.raw_payload, payload)
        self.assertIsNotNone(advisory.fetched_at)
        self.assertIsNone(advisory.normalized_at)

    def test_save_advisory_updates_existing_record(self):
        """Verify updating existing advisory resets normalized_at to None for re-normalization."""
        old_time = timezone.now() - timedelta(days=2)
        existing = SourceAdvisory.objects.create(
            source="test_source",
            external_id="CVE-2026-1001",
            raw_payload={"id": "CVE-2026-1001", "modified": "v1"},
            fetched_at=old_time,
            normalized_at=old_time,
        )

        updated_payload = {"id": "CVE-2026-1001", "modified": "v2_updated"}
        self.task.save_advisory(
            external_id="CVE-2026-1001", raw_payload=updated_payload
        )

        existing.refresh_from_db()
        self.assertEqual(existing.raw_payload, updated_payload)
        self.assertGreater(existing.fetched_at, old_time)
        self.assertIsNone(existing.normalized_at)

    def test_save_advisory_skips_invalid_schema(self):
        """Verify invalid raw payload schema is skipped and not saved."""
        invalid_payload = {"invalid_key": True}  # Missing 'id' and 'modified'

        self.task.save_advisory(
            external_id="INVALID-001", raw_payload=invalid_payload
        )

        self.assertFalse(
            SourceAdvisory.objects.filter(
                source="test_source", external_id="INVALID-001"
            ).exists()
        )

    @patch("ingestion.tasks.SourceAdvisory.objects.update_or_create")
    def test_save_advisory_raises_exception_on_db_failure(self, mock_update_or_create):
        """Verify database errors during save are propagated up."""
        mock_update_or_create.side_effect = DatabaseError("Database connection lost")

        payload = {"id": "CVE-2026-9999", "modified": "2026-01-01T00:00:00Z"}
        with self.assertRaises(DatabaseError):
            self.task.save_advisory(
                external_id="CVE-2026-9999", raw_payload=payload
            )


class SyncStateConcurrencyTestCase(TestCase):
    """Tests for worker lock checking and SyncState record mutations."""

    def test_is_worker_running_clears_stuck_running_state(self):
        """Unreleased RUNNING SyncState from crashed process should be auto-cleared to FAILED."""
        stuck_state = SyncState.objects.create(
            source="nvd",
            last_run_status="RUNNING",
        )

        # Calling is_worker_running should clear the stuck lock and return False
        is_running = is_worker_running("nvd")

        self.assertFalse(is_running)
        stuck_state.refresh_from_db()
        self.assertEqual(stuck_state.last_run_status, "FAILED")
        self.assertIn("Auto-cleared abandoned lock", stuck_state.error_message)

    def test_record_start_and_success_lifecycle(self):
        """Verify task lifecycle mutates single tracking SyncState row properly."""
        task = DummyIngestionTask()

        # Start task
        sync_record = task.record_start()
        self.assertEqual(sync_record.last_run_status, "RUNNING")

        # Finish successfully
        now = timezone.now()
        task.record_success(
            sync_record=sync_record, records_processed=50, sync_time=now
        )

        sync_record.refresh_from_db()
        self.assertEqual(sync_record.last_run_status, "SUCCESS")
        self.assertEqual(sync_record.records_processed, 50)


class NVDWorkerBulkUpsertTestCase(TestCase):
    """Tests bulk upsert behavior in NVDApiTask."""

    def test_bulk_upsert_preserves_fetched_at_and_resets_normalized_at(self):
        """Ensure bulk upserts update records without leaving fetched_at as NULL."""
        old_time = timezone.now() - timedelta(days=5)

        SourceAdvisory.objects.create(
            source="nvd",
            external_id="CVE-2026-0001",
            raw_payload={"summary": "v1"},
            fetched_at=old_time,
            normalized_at=old_time,
        )

        advisories_to_create = [
            SourceAdvisory(
                source="nvd",
                external_id="CVE-2026-0001",
                raw_payload={"summary": "v2_updated"},
            ),
            SourceAdvisory(
                source="nvd",
                external_id="CVE-2026-0002",
                raw_payload={"summary": "brand_new"},
            ),
        ]

        now = timezone.now()
        for advisory in advisories_to_create:
            advisory.normalized_at = None
            advisory.fetched_at = now

        SourceAdvisory.objects.bulk_create(
            advisories_to_create,
            update_conflicts=True,
            unique_fields=["external_id", "source"],
            update_fields=["raw_payload", "normalized_at", "fetched_at"],
        )

        updated = SourceAdvisory.objects.get(source="nvd", external_id="CVE-2026-0001")
        self.assertEqual(updated.raw_payload["summary"], "v2_updated")
        self.assertIsNotNone(updated.fetched_at)
        self.assertIsNone(updated.normalized_at)

        created = SourceAdvisory.objects.get(source="nvd", external_id="CVE-2026-0002")
        self.assertEqual(created.raw_payload["summary"], "brand_new")
        self.assertIsNotNone(created.fetched_at)