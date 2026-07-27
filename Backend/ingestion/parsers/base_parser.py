import logging
from abc import ABC, abstractmethod
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Optional

from django.utils import timezone

from ingestion.models import SourceAdvisory
from .normalized_models import NormalizedVulnerability

logger = logging.getLogger("ingestion_logger")


class BaseParser(ABC):
    """
    Abstract base class for all vendor parsers.

    Responsibilities:
    - Defines the parser contract.
    - Provides common helper methods.
    - Keeps vendor-specific parsers clean and lightweight.

    IMPORTANT:
    Parsers MUST remain stateless.  The ParserFactory
    stores parser *classes* and instantiates a fresh
    parser per call, but keeping them stateless is the
    real safeguard against concurrency bugs.
    """

    @abstractmethod
    def parse(self, advisory: SourceAdvisory) -> NormalizedVulnerability:
        """
        Converts a raw SourceAdvisory payload into a
        NormalizedVulnerability object.
        """
        pass

    # ------------------------------------------------------------------
    # Common Date Parsing
    # ------------------------------------------------------------------

    @staticmethod
    def parse_iso_date(date_str: Optional[str]) -> Optional[datetime]:
        """
        Converts vendor timestamps into timezone-aware datetime.

        Supported formats:

        • ISO-8601
          2025-01-15T12:45:30Z

        • RFC-2822 (AWS RSS)
          Fri, 05 Jun 2026 19:19:25 +0000

        Returns:
            datetime | None

        Never fabricates dates.
        """

        if not date_str:
            return None

        #
        # Try ISO-8601 first
        #
        try:

            clean = str(date_str).replace("Z", "+00:00")

            dt = datetime.fromisoformat(clean)

            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt)

            return dt

        except Exception:
            pass

        #
        # Try RFC-2822 (AWS RSS)
        #
        try:

            dt = parsedate_to_datetime(date_str)

            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt)

            return dt

        except Exception:
            pass

        logger.warning(
            f"Unable to parse datetime '{date_str}'. Returning None."
        )

        return None

    # ------------------------------------------------------------------
    # Common Severity Normalization
    # ------------------------------------------------------------------

    @staticmethod
    def normalize_severity(severity: Optional[str]) -> str:
        """
        Standardizes vendor severity labels.

        Supported Output:

            CRITICAL
            HIGH
            MEDIUM
            LOW
            UNKNOWN
        """

        if not severity:
            return "UNKNOWN"

        severity = severity.upper()

        mapping = {
            "CRITICAL": "CRITICAL",
            "HIGH": "HIGH",
            "IMPORTANT": "HIGH",
            "MEDIUM": "MEDIUM",
            "MODERATE": "MEDIUM",
            "LOW": "LOW",
            "UNKNOWN": "UNKNOWN",
            "REJECTED_BY_VENDOR": "UNKNOWN",
        }

        return mapping.get(severity, "UNKNOWN")

    # ------------------------------------------------------------------
    # Common CPE Extraction
    # ------------------------------------------------------------------

    @staticmethod
    def extract_cpe(cpe_string: str) -> tuple[str, str]:
        """
        Extracts ecosystem and technology name
        from a CPE string.

        Example:

        cpe:2.3:a:apache:tomcat:9.0:*:*:*:*:*:*:*

        Returns:

        ("apache", "tomcat")
        """

        if not cpe_string:
            return "unknown", "unknown"

        try:

            parts = cpe_string.split(":")

            if len(parts) < 5:
                return "unknown", "unknown"

            ecosystem = parts[3].strip() or "unknown"
            tech_name = parts[4].strip() or "unknown"

            return ecosystem, tech_name

        except Exception:
            return "unknown", "unknown"

    # ------------------------------------------------------------------
    # Common Ecosystem Standardization
    # ------------------------------------------------------------------

    @staticmethod
    def normalize_ecosystem(ecosystem: Optional[str]) -> str:
        """
        Converts different vendor ecosystem names
        into a common representation.
        """

        if not ecosystem:
            return "generic"

        eco = ecosystem.lower()

        mapping = {
            "pypi": "pip",
            "python": "pip",
            "pip": "pip",

            "npm": "npm",

            "go": "go",
            "golang": "go",

            "maven": "maven",

            "rubygems": "rubygems",

            "crates.io": "cargo",

            "nuget": "nuget",

            "composer": "composer",
        }

        return mapping.get(eco, eco)

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    @staticmethod
    def validate_display_id(display_id: Optional[str]) -> None:
        """
        Ensures every parsed vulnerability
        has a valid identifier.
        """

        if not display_id:
            raise ValueError(
                "Parser failed to produce a vulnerability identifier."
            )