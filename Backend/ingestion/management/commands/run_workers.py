from django.core.management.base import BaseCommand, CommandError

# Clean absolute import from your application core
# from ingestion.workers.osv_worker import OSVZipIngestionTask
from ingestion.workers.nvd_worker import NVDApiTask
from ingestion.workers.ghsa_git_worker import GHSAGitTask

class Command(BaseCommand):
    help = "Production manager for firing vulnerability ingestion tasks (TL-106)."

    def add_arguments(self, parser):
        parser.add_argument(
            "worker_name",
            type=str,
            choices=["osv", "nvd", "ghsa", "all"],
            help="Specify which ingestion feed to activate, or select 'all'",
        )

    def handle(self, *args, **options):
        target = options["worker_name"]

        # Map strings to instantiation references dynamically
        worker_map = {
            # "osv": OSVZipIngestionTask(),
            "nvd": NVDApiTask(),
            "ghsa": GHSAGitTask(),
        }

        def execute(name, task_instance):
            self.stdout.write(self.style.MIGRATE_LABEL(f"Initializing worker stream: [{name.upper()}]..."))
            try:
                task_instance.run()
                self.stdout.write(self.style.SUCCESS(f"Worker [{name.upper()}] execution lifecycle completed smoothly."))
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"CRITICAL: Worker [{name.upper()}] crashed! Error: {str(e)}"))

        # Execution Routing Logic 
        if target == "all":
            self.stdout.write(self.style.WARNING("Commencing batch execution of ALL ingestion feeds..."))
            for name, instance in worker_map.items():
                execute(name, instance)
        else:
            execute(target, worker_map[target])