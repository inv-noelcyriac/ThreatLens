from django.core.management.base import BaseCommand, CommandError

# Uncomment workers as needed
# from ingestion.workers.aws_worker import AWSIngestionTask
# from ingestion.workers.docker_worker import DockerEcosystemTask, DockerHardenedOSVTask
from ingestion.workers.ghsa_git_worker import GHSAGitTask
# from ingestion.workers.nvd_worker import NVDApiTask
# from ingestion.workers.osv_worker import OSVZipIngestionTask


class Command(BaseCommand):
    help = "Production manager for firing vulnerability ingestion tasks (TL-106)."

    def add_arguments(self, parser):
        parser.add_argument(
            "worker_name",
            type=str,
            choices=["osv", "nvd", "ghsa", "aws", "docker", "all"],
            help="Specify which ingestion feed to activate, or select 'all'",
        )

    def handle(self, *args, **options):
        target = options["worker_name"]

        # Map choices to task class OR list of task classes
        worker_map = {
            # "osv": OSVZipIngestionTask,
            # "nvd": NVDApiTask,
            "ghsa": GHSAGitTask,
            # "aws": AWSIngestionTask,
            # "docker": [DockerEcosystemTask, DockerHardenedOSVTask],
        }

        def execute(name, tasks):
            self.stdout.write(
                self.style.MIGRATE_LABEL(
                    f"Initializing worker stream: [{name.upper()}]..."
                )
            )

            # Convert single class to list for uniform iteration
            task_list = tasks if isinstance(tasks, list) else [tasks]

            for task_class in task_list:
                try:
                    task_instance = task_class()
                    task_instance.run()
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Worker [{name.upper()} - {task_class.__name__}] execution lifecycle completed smoothly."
                        )
                    )
                except Exception as e:
                    self.stderr.write(
                        self.style.ERROR(
                            f"CRITICAL: Worker [{name.upper()} - {task_class.__name__}] crashed! Error: {str(e)}"
                        )
                    )

        # Execution Routing Logic
        if target == "all":
            self.stdout.write(
                self.style.WARNING(
                    "Commencing batch execution of ALL ingestion feeds..."
                )
            )
            for name, tasks in worker_map.items():
                execute(name, tasks)
        else:
            if target not in worker_map:
                raise CommandError(
                    f"Worker '{target}' is currently disabled or unmapped."
                )
            execute(target, worker_map[target])

