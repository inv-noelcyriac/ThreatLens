from django.core.management.base import BaseCommand
from ingestion.tasks import run_full_daily_pipeline

class Command(BaseCommand):
    help = "Triggers the full daily vulnerability ingestion and normalization pipeline."

    def handle(self, *args, **options):
        self.stdout.write("Starting daily pipeline execution...")
        run_full_daily_pipeline()
        self.stdout.write(self.style.SUCCESS("Daily pipeline completed successfully!"))