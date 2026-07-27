# ingestion/services.py
from django.utils import timezone
from ingestion.models import SyncState


def get_last_successful_sync(source_name: str):
    """
    Retrieves the latest successful sync checkpoint for a given source feed.
    Uses idx_syncstate_lookup index for constant-time O(1) performance.
    """
    latest_sync = (
        SyncState.objects.filter(
            source=source_name, last_run_status=SyncState.RunStatus.SUCCESS
        )
        .order_by("-created_at")
        .first()
    )

    return latest_sync.last_successful_sync if latest_sync else None


def start_sync_run(source_name: str, last_checkpoint=None) -> SyncState:
    """
    Creates a SINGLE row for this execution attempt initialized to RUNNING state.
    """
    return SyncState.objects.create(
        source=source_name,
        last_run_status=SyncState.RunStatus.RUNNING,
        last_successful_sync=last_checkpoint,
        error_message=None,
        records_processed=0,
    )


def finish_sync_run_success(
    sync_record: SyncState, records: int, sync_time=None
) -> None:
    """
    Mutates the active task row upon clean completion to SUCCESS.
    Guarantees error_message remains NULL in the database.
    """
    sync_record.last_run_status = SyncState.RunStatus.SUCCESS
    sync_record.records_processed = records
    sync_record.last_successful_sync = sync_time or timezone.now()
    sync_record.error_message = None
    sync_record.save()


def finish_sync_run_failure(sync_record: SyncState, error: str) -> None:
    """
    Mutates the active task row upon error to FAILED.
    """
    sync_record.last_run_status = SyncState.RunStatus.FAILED
    sync_record.error_message = str(error) if error else "Unknown error"
    sync_record.save()