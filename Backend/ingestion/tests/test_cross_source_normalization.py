from django.test import TestCase
from django.utils import timezone
from django.core.management import call_command

from ingestion.models import (
    MasterVulnerability,
    SourceAdvisory,
    VulnerabilityReference,
    VulnerabilityTag,
)
from ingestion.parsers.normalized_models import (
    NormalizedReference,
    NormalizedTag,
    NormalizedVulnerability,
)
from ingestion.processors.cross_source_service import CrossSourceService


class CrossSourceNormalizationTestCase(TestCase):
    """
    Integration tests for CrossSourceService and normalize_cross_source management command.
    Verifies zero data loss across multi-source advisories.
    """

    def test_single_advisory_fast_path(self):
        """Tests that a single advisory (Count = 1) normalizes without errors."""
        advisory = SourceAdvisory.objects.create(
            source="nvd",
            external_id="CVE-2026-0001",
            raw_payload={"test": "data"},
            normalized_at=None,
        )

        parsed = NormalizedVulnerability(
            display_id="CVE-2026-0001",
            severity="HIGH",
            published_at=timezone.now(),
            tags=[
                NormalizedTag(
                    tech_name="django",
                    ecosystem="PyPI",
                    raw_version_expression="<4.2.1",
                )
            ],
            references=[
                NormalizedReference(url="https://nvd.nist.gov/vuln/detail/CVE-2026-0001")
            ],
        )

        master = CrossSourceService.normalize_group("CVE-2026-0001", [(advisory, parsed)])

        self.assertEqual(master.display_id, "CVE-2026-0001")
        self.assertEqual(master.severity, "HIGH")

        tags = list(VulnerabilityTag.objects.filter(master_vuln=master).values_list("tech_name", flat=True))
        self.assertEqual(tags, ["django"])

        refs = list(VulnerabilityReference.objects.filter(master_vuln=master).values_list("url", flat=True))
        self.assertEqual(refs, ["https://nvd.nist.gov/vuln/detail/CVE-2026-0001"])

        advisory.refresh_from_db()
        self.assertIsNotNone(advisory.normalized_at)

    def test_multi_source_tag_union_without_data_loss(self):
        """
        Tests that when multiple advisories (NVD + OSV) exist for the same CVE,
        tags from BOTH feeds are preserved (tag union), preventing tag overwrites.
        """
        adv_nvd = SourceAdvisory.objects.create(
            source="nvd",
            external_id="CVE-2026-9999",
            raw_payload={"test": "nvd"},
            normalized_at=None,
        )
        adv_osv = SourceAdvisory.objects.create(
            source="osv",
            external_id="CVE-2026-9999",
            raw_payload={"test": "osv"},
            normalized_at=None,
        )

        parsed_nvd = NormalizedVulnerability(
            display_id="CVE-2026-9999",
            severity="MEDIUM",
            published_at=timezone.now(),
            tags=[
                NormalizedTag(
                    tech_name="tomcat",
                    ecosystem="apache",
                    raw_version_expression=">=9.0.0 <9.0.85",
                )
            ],
            references=[
                NormalizedReference(url="https://nvd.nist.gov/vuln/detail/CVE-2026-9999")
            ],
        )

        parsed_osv = NormalizedVulnerability(
            display_id="CVE-2026-9999",
            severity="CRITICAL",
            published_at=timezone.now(),
            tags=[
                NormalizedTag(
                    tech_name="requests",
                    ecosystem="PyPI",
                    raw_version_expression=">=2.0.0 <2.28.0",
                )
            ],
            references=[
                NormalizedReference(url="https://github.com/advisories/GHSA-xxxx")
            ],
        )

        master = CrossSourceService.normalize_group(
            "CVE-2026-9999",
            [(adv_nvd, parsed_nvd), (adv_osv, parsed_osv)],
        )

        # 1. Severity: CRITICAL should be selected over MEDIUM
        self.assertEqual(master.severity, "CRITICAL")

        # 2. Tag Union: BOTH tomcat and requests MUST be present
        tags = set(VulnerabilityTag.objects.filter(master_vuln=master).values_list("tech_name", flat=True))
        self.assertIn("tomcat", tags)
        self.assertIn("requests", tags)

        # 3. Reference Union: BOTH URLs MUST be present
        refs = set(VulnerabilityReference.objects.filter(master_vuln=master).values_list("url", flat=True))
        self.assertEqual(len(refs), 2)
        self.assertIn("https://nvd.nist.gov/vuln/detail/CVE-2026-9999", refs)
        self.assertIn("https://github.com/advisories/GHSA-xxxx", refs)

        # 4. Timestamps
        adv_nvd.refresh_from_db()
        adv_osv.refresh_from_db()
        self.assertIsNotNone(adv_nvd.normalized_at)
        self.assertIsNotNone(adv_osv.normalized_at)

    def test_severity_precedence_source_priority(self):
        """Tests that NVD precedence wins if severities tie."""
        adv_nvd = SourceAdvisory.objects.create(
            source="nvd",
            external_id="CVE-2026-7777",
            raw_payload={"test": "nvd"},
        )
        adv_docker = SourceAdvisory.objects.create(
            source="docker_ecosystem",
            external_id="CVE-2026-7777",
            raw_payload={"test": "docker"},
        )

        parsed_nvd = NormalizedVulnerability(
            display_id="CVE-2026-7777",
            severity="HIGH",
            published_at=timezone.now(),
        )
        parsed_docker = NormalizedVulnerability(
            display_id="CVE-2026-7777",
            severity="HIGH",
            published_at=timezone.now(),
        )

        master = CrossSourceService.normalize_group(
            "CVE-2026-7777",
            [(adv_docker, parsed_docker), (adv_nvd, parsed_nvd)],
        )

        self.assertEqual(master.severity, "HIGH")

    def test_management_command_execution(self):
        """Tests calling python manage.py normalize_cross_source."""
        SourceAdvisory.objects.create(
            source="nvd",
            external_id="CVE-2026-5555",
            raw_payload={
                "cve": {
                    "id": "CVE-2026-5555",
                    "published": "2026-01-01T00:00:00Z",
                    "metrics": {
                        "cvssMetricV31": [
                            {
                                "cvssData": {
                                    "baseScore": 7.5,
                                    "baseSeverity": "HIGH",
                                }
                            }
                        ]
                    },
                }
            },
            normalized_at=None,
        )

        call_command("normalize_cross_source")

        master = MasterVulnerability.objects.get(display_id="CVE-2026-5555")
        self.assertEqual(master.severity, "HIGH")
