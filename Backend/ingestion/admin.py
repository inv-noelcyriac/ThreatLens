from django import forms
from django.contrib import admin, messages
from ingestion.models import (
    MasterVulnerability,
    VulnerabilityTag,
    VulnerabilityReference,
    ManualRemediation,
    SourceAdvisory,
)
from search.sync_service import (
    sync_single_vulnerability,
    parse_raw_payload,
)


# -------------------------------------------------------------------
# 1. Custom Form with Virtual Fields
# -------------------------------------------------------------------
class MasterVulnerabilityAdminForm(forms.ModelForm):
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
            # Look up source advisory using external_id matching display_id
            advisory = SourceAdvisory.objects.filter(
                external_id=self.instance.display_id
            ).first()

            if advisory and advisory.raw_payload:
                # Reuse the exact same parsing logic that Meilisearch sync uses
                parsed = parse_raw_payload(advisory.raw_payload)

                descs = parsed.get("descriptions", [])
                rems = parsed.get("vendor_remediations", [])

                # Pre-fill text areas with existing parsed descriptions & remediations
                self.fields["description_override"].initial = (
                    "\n\n".join(descs) if descs else ""
                )
                self.fields["vendor_remediation_override"].initial = (
                    "\n\n".join(rems) if rems else ""
                )


# -------------------------------------------------------------------
# 2. Inlines for Child Models
# -------------------------------------------------------------------
class VulnerabilityTagInline(admin.TabularInline):
    model = VulnerabilityTag
    extra = 0
    fields = (
        "tech_name",
        "ecosystem",
        "raw_version_expression",
        "introduced_version",
        "fixed_version",
    )


class VulnerabilityReferenceInline(admin.TabularInline):
    model = VulnerabilityReference
    extra = 0
    fields = ("url",)


class ManualRemediationInline(admin.StackedInline):
    model = ManualRemediation
    extra = 0
    fields = ("author_name", "guidance_text")


# -------------------------------------------------------------------
# 3. Master Vulnerability Admin
# -------------------------------------------------------------------
@admin.register(MasterVulnerability)
class MasterVulnerabilityAdmin(admin.ModelAdmin):
    form = MasterVulnerabilityAdminForm

    list_display = (
        "display_id",
        "severity",
        "is_hidden",
        "meilisearch_synced",
        "published_at",
    )

    list_editable = ("is_hidden",)

    list_filter = (
        "is_hidden",
        "meilisearch_synced",
        "severity",
    )

    search_fields = ("display_id",)

    readonly_fields = ("meilisearch_synced",)

    # Admin form fields layout
    fields = (
        "display_id",
        "severity",
        "published_at",
        "description_override",          # <-- Pre-filled & Editable Description
        "vendor_remediation_override",   # <-- Pre-filled & Editable Remediation
        "is_hidden",
        "meilisearch_synced",
    )

    inlines = [
        VulnerabilityTagInline,
        VulnerabilityReferenceInline,
        ManualRemediationInline,
    ]

    def save_model(self, request, form, obj, change):
        """Saves edited virtual form fields into SourceAdvisory.raw_payload."""
        super().save_model(request, form, obj, change)

        new_desc = form.cleaned_data.get("description_override", "").strip()
        new_rem = form.cleaned_data.get("vendor_remediation_override", "").strip()

        advisory = SourceAdvisory.objects.filter(external_id=obj.display_id).first()
        if advisory:
            payload = advisory.raw_payload or {}
            if isinstance(payload, str):
                import json
                try:
                    payload = json.loads(payload)
                except Exception:
                    payload = {}

            # Update OSV key 'details' if present, or fallback to 'descriptions' key
            if "details" in payload or not any(k in payload for k in ["cve", "CVE", "descriptions"]):
                payload["details"] = new_desc
            else:
                payload["descriptions"] = [{"value": new_desc}] if new_desc else []

            # Store remediation note in raw_payload
            payload["custom_vendor_remediation"] = new_rem

            advisory.raw_payload = payload
            advisory.save(update_fields=["raw_payload"])

    def save_related(self, request, form, formsets, change):
        """Triggers Meilisearch sync after related records and forms are saved."""
        super().save_related(request, form, formsets, change)

        success = sync_single_vulnerability(form.instance)
        if success:
            messages.success(
                request,
                f"Vulnerability {form.instance.display_id} updated and synced to Meilisearch.",
            )
        else:
            messages.warning(
                request,
                f"Vulnerability {form.instance.display_id} saved to DB, but Meilisearch sync failed.",
            )