from django.db import models

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

    class Meta:
        db_table = 'source_advisories'
        # Ensures that a single vendor source cannot have identical duplicate tracking codes saved
        unique_together = ('source', 'external_id')

    def __str__(self):
        return f"{self.source} - {self.external_id}"