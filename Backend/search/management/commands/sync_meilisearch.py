# search/management/commands/sync_meilisearch.py
from django.core.management.base import BaseCommand
from ingestion.models import MasterVulnerability
from search.sync_service import run_meilisearch_batch_sync
from search.meilisearch_client import configure_vulnerabilities_index
class Command(BaseCommand):
    help = "Syncs unsynced records from PostgreSQL to Meilisearch index."

    def add_arguments(self, parser):
        parser.add_argument(
            '--batch-size',
            type=int,
            default=1000,
            help='Number of records to sync per batch'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force re-syncing all records from PostgreSQL to Meilisearch even if already marked as synced.'
        )

    def handle(self, *args, **options):
        self.stdout.write("Configuring Meilisearch index settings...")
        configure_vulnerabilities_index()
        
        batch_size = options['batch_size']
        force = options['force']

        if force:
            self.stdout.write(self.style.WARNING("Force flag set: Resetting meilisearch_synced status on all records..."))
            MasterVulnerability.objects.all().update(meilisearch_synced=False)

        self.stdout.write(self.style.WARNING(f"Starting Meilisearch batch sync (Batch Size: {batch_size})..."))
        
        result = run_meilisearch_batch_sync(MasterVulnerability, batch_size=batch_size)
        
        if result == "SUCCESS":
            self.stdout.write(self.style.SUCCESS("Meilisearch sync completed successfully!"))
        elif result == "NO_UNSYNCED_RECORDS":
            self.stdout.write(self.style.SUCCESS("All records are already synced."))
        else:
            self.stdout.write(self.style.ERROR("Meilisearch sync encountered errors."))