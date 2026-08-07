import logging
import re
from abc import ABC, abstractmethod
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Optional

from django.utils import timezone

from ingestion.models import SourceAdvisory
from .normalized_models import NormalizedTag, NormalizedVulnerability

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
        Converts vendor ecosystem names into standard representations.
        Strips 'root:' prefix and separates OS distro names from version numbers.
        
        Examples:
          'root:pypi'           -> 'PyPI'
          'root:debian:12'      -> 'Debian'
          'root:ubuntu:22.04'   -> 'Ubuntu'
          'root:alpine:3.18'    -> 'Alpine'
        """
        if not ecosystem:
            return "generic"

        eco = str(ecosystem).strip()

        # Strip case-insensitive 'root:' prefix if present
        if eco.lower().startswith("root:"):
            eco = eco[5:].strip()

        if not eco:
            return "generic"

        # Handle versioned ecosystems like 'debian:12' or 'ubuntu:22.04' -> extract base name
        if ":" in eco:
            eco = eco.split(":")[0].strip()

        # Canonical mapping for ecosystems & package managers
        mapping = {
            "pypi": "PyPI",
            "python": "PyPI",
            "pip": "PyPI",
            "npm": "npm",
            "go": "Go",
            "golang": "Go",
            "maven": "Maven",
            "rubygems": "RubyGems",
            "ruby": "RubyGems",
            "crates.io": "Cargo",
            "cargo": "Cargo",
            "nuget": "NuGet",
            "composer": "Packagist",
            "packagist": "Packagist",
            "alpine": "Alpine",
            "debian": "Debian",
            "ubuntu": "Ubuntu",
            "arch": "Arch Linux",
            "fedora": "Fedora",
            "rhel": "RHEL",
        }

        return mapping.get(eco.lower(), eco.title())

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

# ------------------------------------------------------------------
    # Common Tech Name Normalization
    # ------------------------------------------------------------------

    @staticmethod
    def normalize_tech_name(tech_name: Optional[str]) -> str:
        """
        Standardizes technology and package names while preserving 
        valid hyphenated package names (e.g., 'react-router').
        """
        if not tech_name:
            return "unknown"

        cleaned = str(tech_name).strip()

        # 1. Strip trailing version numbers (e.g., 'buildpacks-spring-boot-5.36.2' -> 'buildpacks-spring-boot')
        cleaned = re.sub(r'-\d+(\.\d+)*.*$', '', cleaned)

        # 2. Strip buildpack / wrapper / container prefixes
        cleaned = re.sub(r'^(buildpacks?|wrapper|docker|pack)-', '', cleaned, flags=re.IGNORECASE)

        # 3. Handle Maven / PURL coordinates (e.g., 'org.springframework.boot:spring-boot-starter')
        if ":" in cleaned:
            parts = cleaned.split(":")
            cleaned = parts[1] if len(parts) > 1 else parts[0]

        # 4. Handle NPM scoped packages (e.g., '@angular/core' -> 'angular-core')
        if cleaned.startswith("@"):
            cleaned = cleaned.lstrip("@").replace("/", "-")

        # 5. Clean special characters, convert to lowercase, PRESERVE HYPHENS!
        cleaned = cleaned.lower()
        cleaned = re.sub(r'[^\w\-]+', '', cleaned).strip('-_')

        return cleaned or "unknown"

    # ------------------------------------------------------------------
    # Common Affected Data Tag Extraction
    # ------------------------------------------------------------------

    @classmethod
    def extract_tags_from_affected(cls, affected_list: list) -> list[NormalizedTag]:
        """
        Parses structured affected items (NVD ADP, CVE 5.0, OSV, GHSA schemas)
        into a list of NormalizedTag objects.
        Handles both nested 'affectedData' arrays and direct package/product items.
        """
        tags = []
        if not isinstance(affected_list, list):
            return tags

        for item in affected_list:
            if not isinstance(item, dict):
                continue

            # Check if this item is a container with nested affectedData (NVD ADP / CVE 5.0 style)
            if "affectedData" in item and isinstance(item["affectedData"], list):
                product_targets = item["affectedData"]
            else:
                product_targets = [item]

            for target in product_targets:
                if not isinstance(target, dict):
                    continue

                # Determine package/tech name
                pkg_name = target.get("packageName")
                product = target.get("product")
                pkg_info = target.get("package", {}) if isinstance(target.get("package"), dict) else {}
                pkg_info_name = pkg_info.get("name")
                vendor = target.get("vendor")

                tech_name = pkg_name or product or pkg_info_name or vendor
                if not tech_name or str(tech_name).upper().startswith("CVE-"):
                    continue

                # Determine ecosystem
                eco_raw = pkg_info.get("ecosystem") or vendor or "generic"
                ecosystem = cls.normalize_ecosystem(eco_raw)

                versions = target.get("versions", [])
                ranges = target.get("ranges", [])

                if isinstance(versions, list) and versions:
                    for v_item in versions:
                        if not isinstance(v_item, dict):
                            continue

                        status = str(v_item.get("status", "")).lower()
                        if status == "unaffected" and not (v_item.get("lessThan") or v_item.get("lessThanOrEqual")):
                            continue

                        ver = v_item.get("version")
                        less_than = v_item.get("lessThan")
                        less_than_eq = v_item.get("lessThanOrEqual")

                        ver_str = str(ver).strip() if ver else ""
                        less_than_str = str(less_than).strip() if less_than else ""
                        less_than_eq_str = str(less_than_eq).strip() if less_than_eq else ""

                        introduced = None
                        fixed = None
                        expr_parts = []

                        # Do not treat ver as lower bound if it equals the upper bound threshold
                        if ver_str and ver_str not in ("*", "0", "0.0.0", "") and ver_str != less_than_str and ver_str != less_than_eq_str:
                            introduced = ver_str
                            expr_parts.append(f">={introduced}")

                        if less_than_str and less_than_str not in ("*", ""):
                            fixed = less_than_str
                            expr_parts.append(f"<{fixed}")
                        elif less_than_eq_str and less_than_eq_str not in ("*", ""):
                            fixed = less_than_eq_str
                            expr_parts.append(f"<={fixed}")

                        if expr_parts:
                            raw_expr = " ".join(expr_parts)
                        elif ver and str(ver).strip() not in ("*", ""):
                            raw_expr = f"={ver}"
                        else:
                            raw_expr = None

                        tags.append(
                            NormalizedTag(
                                tech_name=str(tech_name)[:99],
                                ecosystem=str(ecosystem)[:99],
                                introduced_version=str(introduced)[:99] if introduced else None,
                                fixed_version=str(fixed)[:99] if fixed else None,
                                raw_version_expression=str(raw_expr)[:500] if raw_expr else None,
                            )
                        )
                elif isinstance(ranges, list) and ranges:
                    for r in ranges:
                        if not isinstance(r, dict):
                            continue
                        events = r.get("events", [])
                        if not isinstance(events, list):
                            continue
                        intro_ver = None
                        fixed_ver = None
                        for event in events:
                            if not isinstance(event, dict):
                                continue
                            if "introduced" in event:
                                intro_ver = str(event["introduced"])
                            if "fixed" in event:
                                fixed_ver = str(event["fixed"])

                        expr_parts = []
                        if intro_ver and intro_ver not in ("0", "0.0.0", "*"):
                            expr_parts.append(f">={intro_ver}")
                        if fixed_ver:
                            expr_parts.append(f"<{fixed_ver}")

                        raw_expr = " ".join(expr_parts) if expr_parts else None

                        tags.append(
                            NormalizedTag(
                                tech_name=str(tech_name)[:99],
                                ecosystem=str(ecosystem)[:99],
                                introduced_version=str(intro_ver)[:99] if intro_ver else None,
                                fixed_version=str(fixed_ver)[:99] if fixed_ver else None,
                                raw_version_expression=str(raw_expr)[:500] if raw_expr else None,
                            )
                        )
                else:
                    tags.append(
                        NormalizedTag(
                            tech_name=str(tech_name)[:99],
                            ecosystem=str(ecosystem)[:99],
                        )
                    )

        return tags