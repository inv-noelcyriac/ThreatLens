from rest_framework import serializers
from .models import ManualRemediation

class ManualRemediationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ManualRemediation
        fields = ['id', 'master_vuln', 'author_name', 'guidance_text', 'created_at']
        read_only_fields = ['id', 'master_vuln', 'created_at']

    def validate_author_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Author name is required.")
        return value.strip()

    def validate_guidance_text(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Guidance text is required.")
        return value.strip()