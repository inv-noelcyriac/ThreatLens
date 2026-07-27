from django.db import migrations
from django.db.models import Max


def populate_initial_sync_states(apps, schema_editor):
    """
    Inspects existing SourceAdvisory records to determine the latest baseline timestamp
    for each source feed, seeding initial SyncState audit log entries.
    """
    SourceAdvisory = apps.get_model("ingestion", "SourceAdvisory")
    SyncState = apps.get_model("ingestion", "SyncState")

    # List of known upstream security feed source identifiers
    SOURCES = [
        "nvd",
        "ghsa",
        "osv",
        "aws",
        "docker_ecosystem",
        "docker_hardened_osv",
    ]

    for source_name in SOURCES:
        # Find the latest fetched_at timestamp for this source
        latest_fetch_date = (
            SourceAdvisory.objects.filter(source=source_name)
            .aggregate(latest_date=Max("fetched_at"))["latest_date"]
        )

        # Seed the initial baseline row for this feed
        SyncState.objects.create(
            source=source_name,
            last_successful_sync=latest_fetch_date,
            last_run_status="SUCCESS",
            records_processed=SourceAdvisory.objects.filter(source=source_name).count(),
            error_message="Initial seed baseline from existing SourceAdvisory table",
        )


def reverse_initial_sync_states(apps, schema_editor):
    """Rollback helper to clear seeded rows if migration is reversed."""
    SyncState = apps.get_model("ingestion", "SyncState")
    SyncState.objects.filter(
        error_message="Initial seed baseline from existing SourceAdvisory table"
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("ingestion", "0003_add_sync_state_audit_table"),
    ]

    operations = [
        migrations.RunPython(
            populate_initial_sync_states,
            reverse_code=reverse_initial_sync_states,
        ),
    ]