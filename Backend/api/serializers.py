from rest_framework import serializers
from ingestion.models import (
    MasterVulnerability,
    VulnerabilityTag,
    VulnerabilityReference,
)


class VulnerabilityReferenceSerializer(serializers.ModelSerializer):
    """Serializer for vulnerability references (URLs)."""

    class Meta:
        model = VulnerabilityReference
        fields = ["id", "url"]


class VulnerabilityTagSerializer(serializers.ModelSerializer):
    """Serializer for technology tags and version constraints."""

    class Meta:
        model = VulnerabilityTag
        fields = [
            "id",
            "tech_name",
            "ecosystem",
            "introduced_version",
            "fixed_version",
            "raw_version_expression",
        ]


class MasterVulnerabilitySerializer(serializers.ModelSerializer):
    """
    Main Serializer for vulnerabilities.
    Nests tags and references arrays directly.
    """

    # These variable names ("tags", "references") match the related_name on your ForeignKey models!
    tags = VulnerabilityTagSerializer(many=True, read_only=True)
    references = VulnerabilityReferenceSerializer(many=True, read_only=True)

    class Meta:
        model = MasterVulnerability
        fields = [
            "id",           # UUIDField
            "display_id",   # e.g., CVE-2023-1234
            "severity",     # CRITICAL, HIGH, MEDIUM, LOW, UNKNOWN
            "published_at", # DateTime
            "tags",         # Nested Array of Tags
            "references",   # Nested Array of URLs
        ]