# # ingestion/management/commands/run_scheduler.py
# import logging
# from django.core.management.base import BaseCommand
# from apscheduler.schedulers.blocking import BlockingScheduler
# from apscheduler.triggers.cron import CronTrigger
# from django_apscheduler.jobstores import DjangoJobStore
# from django_apscheduler import util

# # Import task wrappers with DB locking from ingestion/tasks.py
# from ingestion.tasks import (
#     run_ghsa_ingestion,
#     run_nvd_ingestion,
#     run_osv_ingestion,
#     run_aws_ingestion,
#     run_docker_ingestion,
# )

# logger = logging.getLogger("ingestion_logger")


# @util.close_old_connections
# def delete_old_job_executions(max_age=604_800):
#     """Deletes old APScheduler execution logs from PostgreSQL (Older than 7 days)."""
#     from django_apscheduler.models import DjangoJobExecution
#     DjangoJobExecution.objects.delete_old_job_executions(max_age)


# class Command(BaseCommand):
#     help = "Runs APScheduler for daily security feed ingestion."

#     def handle(self, *args, **options):
#         scheduler = BlockingScheduler(timezone="UTC")
#         scheduler.add_jobstore(DjangoJobStore(), "default")

#         # -----------------------------------------------------------------
#         # DAILY STAGGERED INGESTION SCHEDULE (UTC)
#         # -----------------------------------------------------------------

#         # 1. GHSA Task (01:00 AM UTC / 06:30 AM IST)
#         scheduler.add_job(
#             run_ghsa_ingestion,
#             trigger=CronTrigger(hour=1, minute=0),
#             id="sync-ghsa-daily",
#             max_instances=1,
#             replace_existing=True,
#         )

#         # 2. NVD Task (01:30 AM UTC / 07:00 AM IST)
#         scheduler.add_job(
#             run_nvd_ingestion,
#             trigger=CronTrigger(hour=1, minute=30),
#             id="sync-nvd-daily",
#             max_instances=1,
#             replace_existing=True,
#         )

#         # 3. OSV Task (02:15 AM UTC / 07:45 AM IST)
#         scheduler.add_job(
#             run_osv_ingestion,
#             trigger=CronTrigger(hour=2, minute=15),
#             id="sync-osv-daily",
#             max_instances=1,
#             replace_existing=True,
#         )

#         # 4. AWS Task (03:00 AM UTC / 08:30 AM IST)
#         scheduler.add_job(
#             run_aws_ingestion,
#             trigger=CronTrigger(hour=3, minute=0),
#             id="sync-aws-daily",
#             max_instances=1,
#             replace_existing=True,
#         )

#         # 5. Docker Tasks (03:30 AM UTC / 09:00 AM IST)
#         scheduler.add_job(
#             run_docker_ingestion,
#             trigger=CronTrigger(hour=3, minute=30),
#             id="sync-docker-daily",
#             max_instances=1,
#             replace_existing=True,
#         )

#         # Maintenance Task: Weekly cleanup of old execution logs (Every Sunday at midnight)
#         scheduler.add_job(
#             delete_old_job_executions,
#             trigger=CronTrigger(day_of_week="sun", hour=0, minute=0),
#             id="cleanup-old-executions",
#             max_instances=1,
#             replace_existing=True,
#         )

#         logger.info("[APSCHEDULER] Starting Daily Ingestion Scheduler Process...")
        
#         try:
#             scheduler.start()
#         except KeyboardInterrupt:
#             logger.info("[APSCHEDULER] Stopping scheduler process...")
#             scheduler.shutdown()

# ingestion/management/commands/run_scheduler.py
import logging
from django.core.management.base import BaseCommand
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from django_apscheduler.jobstores import DjangoJobStore
from django_apscheduler import util

from ingestion.tasks import (
    run_ghsa_ingestion,
    run_nvd_ingestion,
    run_osv_ingestion,
    run_aws_ingestion,
    run_docker_ingestion,
)

logger = logging.getLogger("ingestion_logger")


@util.close_old_connections
def delete_old_job_executions(max_age=604_800):
    """Deletes old APScheduler execution logs from PostgreSQL."""
    from django_apscheduler.models import DjangoJobExecution
    DjangoJobExecution.objects.delete_old_job_executions(max_age)


class Command(BaseCommand):
    help = "Runs APScheduler for test security feed ingestion."

    def handle(self, *args, **options):
        scheduler = BlockingScheduler(timezone="UTC")
        scheduler.add_jobstore(DjangoJobStore(), "default")

        # -----------------------------------------------------------------
        # TEST SCHEDULE (IST converted to UTC)
        # -----------------------------------------------------------------

        # 1. NVD Task (10:00 AM IST -> 04:30 AM UTC)
        scheduler.add_job(
            run_nvd_ingestion,
            trigger=CronTrigger(hour=4, minute=30),
            id="sync-nvd-test",
            max_instances=1,
            replace_existing=True,
        )

        # 2. OSV Task (10:11 AM IST -> 04:41 AM UTC)
        scheduler.add_job(
            run_osv_ingestion,
            trigger=CronTrigger(hour=4, minute=41),
            id="sync-osv-test",
            max_instances=1,
            replace_existing=True,
        )

        # 3. GHSA Task (10:26 AM IST -> 04:51 AM UTC)
        scheduler.add_job(
            run_ghsa_ingestion,
            trigger=CronTrigger(hour=4, minute=56),
            id="sync-ghsa-test",
            max_instances=1,
            replace_existing=True,
        )

        # 4. AWS Task (10:31 AM IST -> 05:01 AM UTC)
        scheduler.add_job(
            run_aws_ingestion,
            trigger=CronTrigger(hour=5, minute=1),
            id="sync-aws-test",
            max_instances=1,
            replace_existing=True,
        )

        # 5. Docker Tasks (10:41 AM IST -> 05:11 AM UTC)
        scheduler.add_job(
            run_docker_ingestion,
            trigger=CronTrigger(hour=5, minute=11),
            id="sync-docker-test",
            max_instances=1,
            replace_existing=True,
        )

        logger.info("[APSCHEDULER] Starting Test Ingestion Scheduler Process...")
        
        try:
            scheduler.start()
        except KeyboardInterrupt:
            logger.info("[APSCHEDULER] Stopping scheduler process...")
            scheduler.shutdown()