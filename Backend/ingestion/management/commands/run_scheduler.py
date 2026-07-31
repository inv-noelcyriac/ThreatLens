import logging
from django.conf import settings
from django.core.management.base import BaseCommand
from django_apscheduler.jobstores import DjangoJobStore, register_events
from django_apscheduler.models import DjangoJobExecution
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

# Import your ingestion & normalization tasks here
from ingestion.tasks import (
    run_ghsa_ingestion,
    run_nvd_ingestion,
    run_osv_ingestion,
    run_aws_ingestion,
    run_docker_ingestion,
    run_normalization_pipeline,
)

logger = logging.getLogger("ingestion_logger")
IST = pytz.timezone("Asia/Kolkata")


def delete_old_job_executions(max_age=604_800):
    """Deletes APScheduler execution logs older than 7 days from DB."""
    DjangoJobExecution.objects.delete_old_job_executions(max_age)


class Command(BaseCommand):
    help = "Starts the APScheduler process for vulnerability ingestion and normalization."

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
        # 1. INGESTION SCHEDULES (Configured in IST Time)
        # -------------------------------------------------------------------------
        
        # NVD Ingestion: Daily at 10:00 AM IST
        scheduler.add_job(
            run_nvd_ingestion,
            trigger=CronTrigger(hour=10, minute=00, timezone=IST),
            id="run_nvd_ingestion",
            replace_existing=True,
        )

        # GHSA Ingestion: Daily at 10:30 AM IST
        scheduler.add_job(
            run_ghsa_ingestion,
            trigger=CronTrigger(hour=10, minute=5, timezone=IST),
            id="run_ghsa_ingestion",
            replace_existing=True,
        )

        # OSV Ingestion: Daily at 11:00 AM IST
        scheduler.add_job(
            run_osv_ingestion,
            trigger=CronTrigger(hour=10, minute=10, timezone=IST),
            id="run_osv_ingestion",
            replace_existing=True,
        )

        # AWS Ingestion: Daily at 11:30 AM IST
        scheduler.add_job(
            run_aws_ingestion,
            trigger=CronTrigger(hour=10, minute=15, timezone=IST),
            id="run_aws_ingestion",
            replace_existing=True,
        )

        # Docker Ingestion: Daily at 12:00 PM IST
        scheduler.add_job(
            run_docker_ingestion,
            trigger=CronTrigger(hour=10, minute=20, timezone=IST),
            id="run_docker_ingestion",
            replace_existing=True,
        )

        # -------------------------------------------------------------------------
        # 2. NORMALIZATION & PIPELINE SCHEDULES
        # -------------------------------------------------------------------------

        # Normalization Pipeline: Runs daily at 12:30 PM IST (After all ingestions complete)
        scheduler.add_job(
            run_normalization_pipeline,
            trigger=CronTrigger(hour=10, minute=30, timezone=IST),
            id="run_normalization_pipeline",
            replace_existing=True,
        )

        # Maintenance: Clean old execution logs every Sunday at 00:00 IST
        scheduler.add_job(
            delete_old_job_executions,
            trigger=CronTrigger(day_of_week="sun", hour=0, minute=0, timezone=IST),
            id="delete_old_job_executions",
            replace_existing=True,
        )

        register_events(scheduler)
        self.stdout.write(self.style.SUCCESS("[APSCHEDULER] Successfully initialized schedule with IST timezone."))

        try:
            self.stdout.write(self.style.WARNING("Starting scheduler loop... Press Ctrl+C to exit."))
            scheduler.start()
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING("Stopping scheduler..."))
            scheduler.shutdown()
            self.stdout.write(self.style.SUCCESS("Scheduler stopped successfully."))