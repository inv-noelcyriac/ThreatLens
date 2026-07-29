# search/management/commands/setup_meilisearch.py
from django.core.management.base import BaseCommand
from search.meilisearch_client import configure_vulnerabilities_index

class Command(BaseCommand):
    help = "Initializes Meilisearch index settings (searchable, filterable, sortable attributes)."

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Configuring Meilisearch index settings..."))
        try:
            configure_vulnerabilities_index()
            self.stdout.write(self.style.SUCCESS("Successfully configured Meilisearch index settings!"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Failed to configure index: {e}"))