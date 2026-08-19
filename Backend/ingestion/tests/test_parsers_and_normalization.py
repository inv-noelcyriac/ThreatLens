import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch

from django.test import TestCase
from django.utils import timezone

from ingestion.models import (
    MasterVulnerability,
    SourceAdvisory,
    VulnerabilityReference,
    VulnerabilityTag,
)
from ingestion.parsers.aws_parser import AWSParser
from ingestion.parsers.base_parser import BaseParser
from ingestion.parsers.docker_parser import DockerParser
from ingestion.parsers.ghsa_parser import GHSAParser
from ingestion.parsers.nvd_parser import NVDParser
from ingestion.parsers.osv_parser import OSVParser
from ingestion.parsers.parser_factory import ParserFactory
from ingestion.parsers.normalized_models import (
    NormalizedReference,
    NormalizedTag,
    NormalizedVulnerability,
)
# Updated import paths:
from ingestion.processors.normalization_service import NormalizationService
from ingestion.processors.reference_service import ReferenceService
from ingestion.processors.tag_service import TagService

# ==============================================================================
# 1. PARSER FACTORY TESTS
# ==============================================================================

class ParserFactoryTestCase(TestCase):
    """Tests for ParserFactory class retrieval and error handling."""

    def test_get_parser_returns_correct_instance(self):
        self.assertIsInstance(ParserFactory.get_parser("nvd"), NVDParser)
        self.assertIsInstance(ParserFactory.get_parser("ghsa"), GHSAParser)
        self.assertIsInstance(ParserFactory.get_parser("osv"), OSVParser)
        self.assertIsInstance(ParserFactory.get_parser("aws"), AWSParser)
        self.assertIsInstance(ParserFactory.get_parser("docker_ecosystem"), DockerParser)
        self.assertIsInstance(ParserFactory.get_parser("docker_hardened_osv"), OSVParser)

    def test_get_parser_case_insensitive(self):
        self.assertIsInstance(ParserFactory.get_parser("NVD"), NVDParser)
        self.assertIsInstance(ParserFactory.get_parser("GhSa"), GHSAParser)

    def test_get_parser_raises_value_error_for_unknown_source(self):
        with self.assertRaises(ValueError) as ctx:
            ParserFactory.get_parser("unknown_vendor")
        self.assertIn("No parser registered for source 'unknown_vendor'", str(ctx.exception))

    def test_get_parser_raises_value_error_for_empty_source(self):
        with self.assertRaises(ValueError):
            ParserFactory.get_parser("")


# ==============================================================================
# 2. BASE PARSER HELPER TESTS
# ==============================================================================

class BaseParserHelperTestCase(TestCase):
    """Tests for BaseParser static utility methods."""

    def test_parse_iso_date_valid_formats(self):
        # ISO-8601 UTC
        dt_iso = BaseParser.parse_iso_date("2026-01-15T12:45:30Z")
        self.assertIsNotNone(dt_iso)
        self.assertEqual(dt_iso.year, 2026)

        # RFC-2822
        dt_rfc = BaseParser.parse_iso_date("Fri, 05 Jun 2026 19:19:25 +0000")
        self.assertIsNotNone(dt_rfc)
        self.assertEqual(dt_rfc.year, 2026)

    def test_parse_iso_date_returns_none_for_invalid(self):
        self.assertIsNone(BaseParser.parse_iso_date(None))
        self.assertIsNone(BaseParser.parse_iso_date("invalid-date-string"))

    def test_normalize_severity(self):
        self.assertEqual(BaseParser.normalize_severity("CRITICAL"), "CRITICAL")
        self.assertEqual(BaseParser.normalize_severity("important"), "HIGH")
        self.assertEqual(BaseParser.normalize_severity("MODERATE"), "MEDIUM")
        self.assertEqual(BaseParser.normalize_severity("low"), "LOW")
        self.assertEqual(BaseParser.normalize_severity(None), "UNKNOWN")
        self.assertEqual(BaseParser.normalize_severity("UNKNOWN_LABEL"), "UNKNOWN")

    def test_extract_cpe(self):
        eco, tech = BaseParser.extract_cpe("cpe:2.3:a:apache:tomcat:9.0:*:*:*:*:*:*:*")
        self.assertEqual(eco, "apache")
        self.assertEqual(tech, "tomcat")

        eco_invalid, tech_invalid = BaseParser.extract_cpe("invalid_cpe_string")
        self.assertEqual(eco_invalid, "unknown")
        self.assertEqual(tech_invalid, "unknown")

    def test_normalize_ecosystem(self):
        self.assertEqual(BaseParser.normalize_ecosystem("root:pypi"), "PyPI")
        self.assertEqual(BaseParser.normalize_ecosystem("root:debian:12"), "Debian")
        self.assertEqual(BaseParser.normalize_ecosystem("ubuntu:22.04"), "Ubuntu")
        self.assertEqual(BaseParser.normalize_ecosystem("golang"), "Go")
        self.assertEqual(BaseParser.normalize_ecosystem(None), "generic")

    def test_normalize_tech_name(self):
        self.assertEqual(BaseParser.normalize_tech_name("buildpacks-spring-boot-5.36.2"), "spring-boot")
        self.assertEqual(BaseParser.normalize_tech_name("@angular/core"), "angular-core")
        self.assertEqual(BaseParser.normalize_tech_name("org.apache.tomcat:tomcat-embed-core"), "tomcat-embed-core")
        self.assertEqual(BaseParser.normalize_tech_name(None), "unknown")


# ==============================================================================
# 3. VENDOR PARSER TESTS
# ==============================================================================

class VendorParsersTestCase(TestCase):
    """Tests parsing logic across NVD, OSV, GHSA, and AWS parsers."""

    def test_nvd_parser(self):
        advisory = SourceAdvisory(
            external_id="CVE-2026-1111",
            source="nvd",
            raw_payload={
                "cve": {
                    "id": "CVE-2026-1111",
                    "published": "2026-02-01T10:00:00Z",
                    "descriptions": [{"lang": "en", "value": "A remote code execution vulnerability."}],
                    "metrics": {
                        "cvssMetricV31": [
                            {
                                "cvssData": {
                                    "baseScore": 9.8,
                                    "baseSeverity": "CRITICAL",
                                    "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
                                }
                            }
                        ]
                    },
                    "references": [{"url": "https://nvd.nist.gov/vuln/detail/CVE-2026-1111"}],
                    "configurations": [
                        {
                            "nodes": [
                                {
                                    "cpeMatch": [
                                        {
                                            "criteria": "cpe:2.3:a:apache:tomcat:9.0:*:*:*:*:*:*:*",
                                            "versionStartIncluding": "9.0.0",
                                            "versionEndExcluding": "9.0.85",
                                        }
                                    ]
                                }
                            ]
                        }
                    ],
                }
            },
        )

        parser = NVDParser()
        norm = parser.parse(advisory)

        self.assertEqual(norm.display_id, "CVE-2026-1111")
        self.assertEqual(norm.severity, "CRITICAL")
        self.assertEqual(norm.cvss_score, 9.8)
        self.assertEqual(len(norm.references), 1)
        self.assertEqual(len(norm.tags), 1)
        self.assertEqual(norm.tags[0].tech_name, "tomcat")
        self.assertEqual(norm.tags[0].raw_version_expression, ">=9.0.0 <9.0.85")

    def test_osv_parser(self):
        advisory = SourceAdvisory(
            external_id="GHSA-xxxx-yyyy-zzzz",
            source="osv",
            raw_payload={
                "id": "GHSA-xxxx-yyyy-zzzz",
                "published": "2026-03-01T00:00:00Z",
                "database_specific": {"severity": "HIGH"},
                "affected": [
                    {
                        "package": {"name": "requests", "ecosystem": "PyPI"},
                        "ranges": [
                            {
                                "type": "ECOSYSTEM",
                                "events": [{"introduced": "2.0.0"}, {"fixed": "2.28.0"}],
                            }
                        ],
                    }
                ],
                "references": [{"url": "https://github.com/advisories/GHSA-xxxx-yyyy-zzzz"}],
            },
        )

        parser = OSVParser()
        norm = parser.parse(advisory)

        self.assertEqual(norm.display_id, "GHSA-xxxx-yyyy-zzzz")
        self.assertEqual(norm.severity, "HIGH")
        self.assertEqual(len(norm.tags), 1)
        self.assertEqual(norm.tags[0].tech_name, "requests")
        self.assertEqual(norm.tags[0].ecosystem, "PyPI")
        self.assertEqual(norm.tags[0].raw_version_expression, ">=2.0.0 <2.28.0")

    def test_ghsa_parser_prefers_cve_alias(self):
        advisory = SourceAdvisory(
            external_id="GHSA-1234-5678-9012",
            source="ghsa",
            raw_payload={
                "id": "GHSA-1234-5678-9012",
                "aliases": ["CVE-2026-9999"],
                "database_specific": {"severity": "MEDIUM"},
            },
        )

        parser = GHSAParser()
        norm = parser.parse(advisory)

        # Must override display_id with CVE alias
        self.assertEqual(norm.display_id, "CVE-2026-9999")

    def test_aws_parser(self):
        advisory = SourceAdvisory(
            external_id="ALAS-2026-001",
            source="aws",
            raw_payload={
                "title": "Security Bulletin for AWS CodeBuild",
                "pubDate": "Fri, 05 Jun 2026 19:19:25 +0000",
                "link": "https://aws.amazon.com/security/security-bulletins/ALAS-2026-001/",
                "description": (
                    "<html><body>"
                    "Bulletin ID: ALAS-2026-001<br>"
                    "Content Type: Important<br>"
                    "Resolution: CodeBuild <1.5.0"
                    "</body></html>"
                ),
            },
        )

        parser = AWSParser()
        norm = parser.parse(advisory)

        self.assertEqual(norm.display_id, "ALAS-2026-001")
        self.assertEqual(norm.severity, "HIGH")  # 'Important' maps to 'HIGH'
        self.assertEqual(len(norm.tags), 1)
        self.assertEqual(norm.tags[0].tech_name, "CodeBuild")
        self.assertEqual(norm.tags[0].raw_version_expression, "<1.5.0")


# ==============================================================================
# 4. SERVICES AND NORMALIZATION PIPELINE TESTS
# ==============================================================================

class NormalizationServiceTestCase(TestCase):
    """Integration tests for NormalizationService, TagService, and ReferenceService."""

    def test_complete_normalization_pipeline(self):
        advisory = SourceAdvisory.objects.create(
            source="nvd",
            external_id="CVE-2026-8888",
            raw_payload={"test": "data"},
            normalized_at=None,
        )

        norm_vuln = NormalizedVulnerability(
            display_id="CVE-2026-8888",
            severity="CRITICAL",
            published_at=timezone.now(),
            title="Critical Buffer Overflow",
            description="Allows remote code execution.",
            cvss_score=9.8,
            cvss_vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
            tags=[
                NormalizedTag(
                    tech_name="openssl",
                    ecosystem="Debian",
                    introduced_version="1.1.1",
                    fixed_version="1.1.1t",
                    raw_version_expression=">=1.1.1 <1.1.1t",
                )
            ],
            references=[
                NormalizedReference(url="https://openssl.org/news/secadv/20260101.txt")
            ],
        )

        # Run pipeline
        NormalizationService.normalize(advisory, norm_vuln)

        # Verify MasterVulnerability
        master = MasterVulnerability.objects.get(display_id="CVE-2026-8888")
        self.assertEqual(master.severity, "CRITICAL")
        self.assertIsNotNone(master.published_at)

        # Verify Tags
        tags = VulnerabilityTag.objects.filter(master_vuln=master)
        self.assertEqual(tags.count(), 1)
        self.assertEqual(tags.first().tech_name, "openssl")

        # Verify References
        refs = VulnerabilityReference.objects.filter(master_vuln=master)
        self.assertEqual(refs.count(), 1)
        self.assertEqual(refs.first().url, "https://openssl.org/news/secadv/20260101.txt")

        # Verify SourceAdvisory normalized_at was stamped
        advisory.refresh_from_db()
        self.assertIsNotNone(advisory.normalized_at)

    def test_tag_service_cleans_stale_tags_on_re_normalization(self):
        master = MasterVulnerability.objects.create(
            display_id="CVE-2026-7777",
            severity="MEDIUM",
            published_at=timezone.now(),  # Fix: required non-null field
        )

        # Create initial tag
        VulnerabilityTag.objects.create(
            master_vuln=master,
            tech_name="old-tech",
            ecosystem="generic",
        )

        new_tags = [
            NormalizedTag(tech_name="new-tech", ecosystem="PyPI")
        ]

        # Sync updated tags
        TagService.sync(master, new_tags)

        # Ensure old tag was removed and replaced
        current_tags = list(
            VulnerabilityTag.objects.filter(master_vuln=master).values_list("tech_name", flat=True)
        )
        self.assertEqual(current_tags, ["new-tech"])