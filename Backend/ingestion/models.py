import uuid

from django.contrib.postgres.fields import ArrayField
from django.db import models


# ---- TABLE 1 --------

class SourceAdvisory(models.Model):
    objects = models.Manager()

    # A simple row tracking number that automatically grows
    id = models.BigAutoField(primary_key=True)

    # The name of the vendor who sent us the data (like 'nvd' or 'github')
    source = models.CharField(max_length=50)

    # The original tracking code used by the vendor
    external_id = models.CharField(max_length=100)

    # A highly flexible storage container that holds the raw layout exactly as it came to us
    raw_payload = models.JSONField()

    # Logs the exact date and time we downloaded the file, normalized to UTC
    fetched_at = models.DateTimeField(auto_now_add=True)

    normalized_at = models.DateTimeField(null=True, blank=True, db_index=True)



    class Meta:
        db_table = 'source_advisories'
        # Ensures that a single vendor source cannot have identical duplicate tracking codes saved
        unique_together = ('source', 'external_id')

    def __str__(self):
        return f"{self.source} - {self.external_id}"


# ----- TABLE 6 -------

class SyncState(models.Model):
    """
    Audit log table tracking individual ingestion job executions, execution statuses,
    processed record counts, and failure diagnostics for external security feeds.
    """

    class RunStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        RUNNING = "RUNNING", "Running"
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"

    source = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Feeder source identifier (e.g., nvd, ghsa, osv, aws, docker_ecosystem)",
    )
    last_successful_sync = models.DateTimeField(
        null=True,
        blank=True,
        help_text="UTC timestamp used as the delta baseline for this specific sync cycle",
    )
    last_run_status = models.CharField(
        max_length=20,
        choices=RunStatus.choices,
        default=RunStatus.PENDING,  # Changed default from RUNNING to PENDING
        help_text="Execution state of this job run (PENDING, RUNNING, SUCCESS, FAILED)",
    )
    records_processed = models.IntegerField(
        default=0,
        help_text="Number of records inserted or updated during this specific run cycle",
    )
    error_message = models.TextField(
        null=True,
        blank=True,  # Made nullable instead of hardcoded default string
        help_text="Diagnostic exception string or failure stack trace if job failed",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="UTC timestamp when this job execution entry was recorded",
    )

    class Meta:
        db_table = "ingestion_sync_state"
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["source", "last_run_status", "-created_at"],
                name="idx_syncstate_lookup",
            ),
        ]

    def __str__(self):
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M')}] {self.source} - {self.last_run_status}"


# ---------- TABLE 2 ----------

class MasterVulnerability(models.Model):
    """Table 2: master_vulnerabilities"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    display_id = models.CharField(max_length=100, unique=True, db_index=True)
    severity = models.CharField(max_length=35, default='UNKNOWN')
    published_at = models.DateTimeField(db_index=True)
    meilisearch_synced = models.BooleanField(default=False)
    is_hidden = models.BooleanField(
        default=False, 
        help_text="If checked, this vulnerability will be hidden from the public API."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'master_vulnerabilities'

    def __str__(self):
        return f"{self.display_id} [{self.severity}]"


# ------------ TABLE 3 -------

class VulnerabilityTag(models.Model):
    """Table 3: vulnerability_tags"""
    id = models.BigAutoField(primary_key=True)
    master_vuln = models.ForeignKey(MasterVulnerability, on_delete=models.CASCADE, db_column='master_vuln_id', related_name='tags')
    tech_name = models.CharField(max_length=255)
    ecosystem = models.CharField(max_length=150)
    introduced_version = models.CharField(max_length=100, null=True, blank=True)
    fixed_version = models.CharField(max_length=100, null=True, blank=True)

    # Increased from 100 to 512 — CPE strings and complex
    # version expressions regularly exceed 100 characters.
    raw_version_expression = models.CharField(max_length=512, null=True, blank=True)

    class Meta:
        db_table = 'vulnerability_tags'
        constraints = [
            models.UniqueConstraint(
                fields=[
                    'master_vuln',
                    'tech_name',
                    'ecosystem',
                    'raw_version_expression',
                ],
                name='uq_tag_per_vuln',
            ),
        ]


# ------ TABLE 5 ------

class VulnerabilityReference(models.Model):
    """Table 4: vulnerability_references"""
    id = models.BigAutoField(primary_key=True)
    master_vuln = models.ForeignKey(
        MasterVulnerability,
        on_delete=models.CASCADE,
        db_column='master_vuln_id',
        related_name='references',
    )
    url = models.TextField()

    class Meta:
        db_table = 'vulnerability_references'
        # Ensures duplicate reference links are filtered at SQL engine level
        unique_together = (('master_vuln', 'url'),)



#--------- TABLE 4 ----------------

class ManualRemediation(models.Model):
    master_vuln = models.ForeignKey(
        'ingestion.MasterVulnerability',  # Adjust path if in another app
        on_delete=models.CASCADE,
        related_name='remediations'
    )
    author_name = models.CharField(max_length=100)
    guidance_text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'manual_remediations'
        ordering = ['-created_at']

    def __str__(self):
        return f"Note by {self.author_name} on {self.master_vuln.display_id}"