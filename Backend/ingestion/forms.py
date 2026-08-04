from django import forms
from ingestion.models import (
    MasterVulnerability,
    SourceAdvisory,
    VulnerabilityTag,
    VulnerabilityReference,
    ManualRemediation,
)
from search.sync_service import parse_raw_payload


# ===================================================================
# 1. Main Master Vulnerability Admin Form
# ===================================================================
class MasterVulnerabilityAdminForm(forms.ModelForm):
    display_id = forms.CharField(
        max_length=255,
        required=True,
        help_text="Required. Must start with 'ADMIN-' if manually creating a new vulnerability.",
    )
    severity = forms.CharField(
        max_length=50,
        required=True,
        help_text="Required (CRITICAL, HIGH, MEDIUM, LOW, UNKNOWN).",
    )
    description_override = forms.CharField(
        widget=forms.Textarea(attrs={"rows": 4, "style": "width: 100%;"}),
        required=False,
        label="Description",
        help_text="Edit description (updates underlying SourceAdvisory JSON payload).",
    )
    vendor_remediation_override = forms.CharField(
        widget=forms.Textarea(attrs={"rows": 4, "style": "width: 100%;"}),
        required=False,
        label="Vendor Remediation",
        help_text="Edit vendor remediation notes.",
    )

    class Meta:
        model = MasterVulnerability
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            advisory = SourceAdvisory.objects.filter(
                external_id=self.instance.display_id
            ).first()

            if advisory and advisory.raw_payload:
                parsed = parse_raw_payload(advisory.raw_payload)
                descs = parsed.get("descriptions", [])
                rems = parsed.get("vendor_remediations", [])

                self.fields["description_override"].initial = (
                    "\n\n".join(descs) if descs else ""
                )
                self.fields["vendor_remediation_override"].initial = (
                    "\n\n".join(rems) if rems else ""
                )

    # --- VALIDATIONS ---

    def clean_display_id(self):
        """
        Enforce mandatory display_id and 'ADMIN-' prefix when creating a new record.
        """
        display_id = self.cleaned_data.get("display_id", "").strip()

        if not display_id:
            raise forms.ValidationError("Display ID is mandatory and cannot be empty.")

        # Check if creating a NEW record (using _state.adding instead of pk)
        is_new_record = self.instance._state.adding if self.instance else True

        if is_new_record:
            if not display_id.upper().startswith("ADMIN-"):
                raise forms.ValidationError(
                    "Manually created vulnerabilities MUST have a Display ID starting with 'ADMIN-' (e.g., ADMIN-CVE-2026-0001)."
                )

        return display_id

    def clean_severity(self):
        """Ensure mandatory severity matches allowed system standard choices."""
        severity = self.cleaned_data.get("severity", "").strip().upper()

        if not severity:
            raise forms.ValidationError("Severity is mandatory.")

        allowed = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"]
        if severity not in allowed:
            raise forms.ValidationError(
                f"Severity must be one of: {', '.join(allowed)}"
            )

        return severity


# ===================================================================
# 2. Vulnerability Tags Inline Form (Strict Mandatory Checks)
# ===================================================================
class VulnerabilityTagForm(forms.ModelForm):
    tech_name = forms.CharField(required=True, label="Tech Name")
    ecosystem = forms.CharField(required=True, label="Ecosystem")
    introduced_version = forms.CharField(required=True, label="Introduced Version")

    class Meta:
        model = VulnerabilityTag
        fields = "__all__"

    def clean_tech_name(self):
        val = self.cleaned_data.get("tech_name", "").strip()
        if not val:
            raise forms.ValidationError("Tech Name is mandatory.")
        return val

    def clean_ecosystem(self):
        val = self.cleaned_data.get("ecosystem", "").strip()
        if not val:
            raise forms.ValidationError("Ecosystem is mandatory.")
        return val

    def clean_introduced_version(self):
        val = self.cleaned_data.get("introduced_version", "").strip()
        if not val:
            raise forms.ValidationError("Introduced Version is mandatory.")
        return val


# ===================================================================
# 3. Vulnerability References Inline Form
# ===================================================================
class VulnerabilityReferenceForm(forms.ModelForm):
    class Meta:
        model = VulnerabilityReference
        fields = "__all__"

    def clean_url(self):
        url = self.cleaned_data.get("url", "").strip()
        if url and not (url.startswith("http://") or url.startswith("https://")):
            raise forms.ValidationError("URL must start with http:// or https://")
        return url


# ===================================================================
# 4. Manual Remediations Inline Form
# ===================================================================
class ManualRemediationForm(forms.ModelForm):
    class Meta:
        model = ManualRemediation
        fields = "__all__"