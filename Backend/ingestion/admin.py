import json
from django import forms
from django.contrib import admin, messages
from django.forms.models import BaseInlineFormSet

from ingestion.models import (
    MasterVulnerability,
    VulnerabilityTag,
    VulnerabilityReference,
    ManualRemediation,
    SourceAdvisory,
)
from search.sync_service import (
    sync_single_vulnerability,
    delete_single_vulnerability,
)
from ingestion.forms import (
    MasterVulnerabilityAdminForm,
    VulnerabilityTagForm,
    VulnerabilityReferenceForm,
    ManualRemediationForm,
)
from django.contrib import admin
admin.site.site_url = "http://10.10.13.83:5173/"  # Or your frontend app URL

# 1. Changes the header text on the login page and top of admin pages (e.g., replaces "Django administration")
admin.site.site_header = "ThreatLens Administration"

# 2. Changes the title on the admin homepage (e.g., "Site administration" -> "ThreatLens Admin Portal")
admin.site.index_title = "ThreatLens Management Console"

# 3. Changes the title displayed in the browser tab
admin.site.site_title = "ThreatLens Admin"

# -------------------------------------------------------------------
# 1. Custom FormSet to guarantee AT LEAST ONE tag is created
# -------------------------------------------------------------------
class MandatoryTagFormSet(BaseInlineFormSet):
    def clean(self):
        super().clean()
        if any(self.errors):
            return

        valid_forms = 0
        for form in self.forms:
            if form.cleaned_data and not form.cleaned_data.get("DELETE", False):
                valid_forms += 1

        if valid_forms < 1:
            raise forms.ValidationError(
                "At least ONE Vulnerability Tag (with Tech Name, Ecosystem, and Introduced Version) is required."
            )


# -------------------------------------------------------------------
# 2. Inlines for Child Models
# -------------------------------------------------------------------
class VulnerabilityTagInline(admin.TabularInline):
    model = VulnerabilityTag
    form = VulnerabilityTagForm
    formset = MandatoryTagFormSet
    extra = 1
    min_num = 1
    validate_min = True
    fields = (
        "tech_name",
        "ecosystem",
        "raw_version_expression",
        "introduced_version",
        "fixed_version",
    )


class VulnerabilityReferenceInline(admin.TabularInline):
    model = VulnerabilityReference
    form = VulnerabilityReferenceForm
    extra = 0
    fields = ("url",)


class ManualRemediationInline(admin.StackedInline):
    model = ManualRemediation
    form = ManualRemediationForm
    extra = 0
    fields = ("user", "guidance_text")


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
    list_filter = ("is_hidden", "meilisearch_synced", "severity")
    search_fields = ("display_id",)
    readonly_fields = ("meilisearch_synced",)

    fields = (
        "display_id",
        "severity",
        "published_at",
        "description_override",
        "vendor_remediation_override",
        "is_hidden",
        "meilisearch_synced",
    )

    inlines = [
        VulnerabilityTagInline,
        VulnerabilityReferenceInline,
        ManualRemediationInline,
    ]

    def save_model(self, request, obj, form, change):
        """Saves edited virtual form fields into SourceAdvisory.raw_payload without destroying source raw data."""
        super().save_model(request, obj, form, change)

        new_desc = form.cleaned_data.get("description_override", "").strip()
        new_rem = form.cleaned_data.get("vendor_remediation_override", "").strip()

        advisory = SourceAdvisory.objects.filter(external_id=obj.display_id).first()
        if advisory:
            payload = advisory.raw_payload or {}
            if isinstance(payload, str):
                try:
                    payload = json.loads(payload)
                except Exception:
                    payload = {}

            if "details" in payload or not any(
                k in payload for k in ["cve", "CVE", "descriptions"]
            ):
                payload["details"] = new_desc
            else:
                payload["descriptions"] = [{"value": new_desc}] if new_desc else []

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

    # -------------------------------------------------------------------
    # Deletion Hooks for Meilisearch Sync
    # -------------------------------------------------------------------

    def delete_model(self, request, obj):
        """Removes the record from Meilisearch when deleted individually."""
        obj_id = str(obj.id)
        display_id = obj.display_id

        # Perform database delete first
        super().delete_model(request, obj)

        # Delete from Meilisearch index
        if delete_single_vulnerability(obj_id):
            messages.success(
                request,
                f"Vulnerability {display_id} deleted from database and Meilisearch.",
            )
        else:
            messages.warning(
                request,
                f"Vulnerability {display_id} deleted from DB, but failed to delete from Meilisearch.",
            )

    def delete_queryset(self, request, queryset):
        """Removes records from Meilisearch when deleted in bulk via action."""
        # Grab IDs before deleting from DB
        obj_data = list(queryset.values_list("id", "display_id"))

        super().delete_queryset(request, queryset)

        # Delete each document from Meilisearch index
        for obj_id, display_id in obj_data:
            delete_single_vulnerability(str(obj_id))

        messages.success(
            request,
            "Selected vulnerabilities removed from database and Meilisearch index.",
        )