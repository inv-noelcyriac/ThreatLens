import logging
from django.conf import settings
from django.core.management.base import BaseCommand
from django_apscheduler.jobstores import DjangoJobStore
from django_apscheduler.models import DjangoJobExecution
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

# Import consolidated master daily pipeline
from ingestion.tasks import run_full_daily_pipeline

logger = logging.getLogger("ingestion_logger")
IST = pytz.timezone("Asia/Kolkata")


def delete_old_job_executions(max_age=604_800):
    """Deletes APScheduler execution logs older than 7 days from DB."""
    DjangoJobExecution.objects.delete_old_job_executions(max_age)


class Command(BaseCommand):
    help = "Starts the APScheduler process for vulnerability ingestion, AI enrichment, and normalization."

    def handle(self, *args, **options):
        scheduler = BlockingScheduler(
            timezone=IST,
            job_defaults={
                "misfire_grace_time": 3600 * 4,  # Catch up if delayed by up to 4 hours
                "coalesce": True,                # Collapse multiple missed runs into 1 single run
                "max_instances": 1,              # Prevent concurrent runs of the exact same job
            }
        )
        scheduler.add_jobstore(DjangoJobStore(), "default")

        # -------------------------------------------------------------------------
        # 1. DAILY MASTER PIPELINE (Executes Ingestion -> Normalization -> AI -> Meilisearch)
        # -------------------------------------------------------------------------
        
        # Runs every morning at 10:00 AM IST
        scheduler.add_job(
            run_full_daily_pipeline,
            trigger=CronTrigger(hour=10, minute=0, timezone=IST),
            id="run_full_daily_pipeline",
            replace_existing=True,
        )

        # -------------------------------------------------------------------------
        # 2. MAINTENANCE SCHEDULES
        # -------------------------------------------------------------------------

        # Clean old execution logs every Sunday at 00:00 IST
        scheduler.add_job(
            delete_old_job_executions,
            trigger=CronTrigger(day_of_week="sun", hour=0, minute=0, timezone=IST),
            id="delete_old_job_executions",
            replace_existing=True,
        )

        self.stdout.write(self.style.SUCCESS("[APSCHEDULER] Successfully initialized schedule with IST timezone."))

        try:
            self.stdout.write(self.style.WARNING("Starting scheduler loop... Press Ctrl+C to exit."))
            scheduler.start()
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING("Stopping scheduler..."))
            scheduler.shutdown()
            self.stdout.write(self.style.SUCCESS("Scheduler stopped successfully."))