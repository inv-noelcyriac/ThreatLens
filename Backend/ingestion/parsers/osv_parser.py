import logging

# Standard Python library for parsing CVSS vectors (v2, v3, v4)
from cvss import parse_vector

from ingestion.models import SourceAdvisory

from .base_parser import BaseParser
from .normalized_models import (
    NormalizedReference,
    NormalizedTag,
    NormalizedVulnerability,
)

logger = logging.getLogger("ingestion_logger")


class OSVParser(BaseParser):
    """
    Parser for OpenSSF OSV schema.

    Converts OSV advisories into the common
    NormalizedVulnerability model.
    """

    def parse(self, advisory: SourceAdvisory) -> NormalizedVulnerability:

        logger.info(
            f"[OSV Parser] Parsing advisory '{advisory.external_id}'..."
        )

        payload = advisory.raw_payload or {}

        display_id = payload.get("id") or advisory.external_id

        self.validate_display_id(display_id)

        severity = self._extract_severity(payload)

        published_at = self.parse_iso_date(
            payload.get("published") or payload.get("modified")
        )

        references = self._extract_references(payload)

        tags = self._extract_tags(payload)

        logger.info(
            f"[OSV Parser] Parsed '{display_id}' "
            f"({len(tags)} tags, {len(references)} references)."
        )

        return NormalizedVulnerability(
            display_id=display_id,
            severity=severity,
            published_at=published_at,
            tags=tags,
            references=references,
        )

    # ----------------------------------------------------------
    # Private Helpers
    # ----------------------------------------------------------

    def _extract_severity(self, payload: dict) -> str:
        """
        Extract severity from the OSV payload.

        Priority:
            1. database_specific.severity (String like 'MODERATE', 'HIGH')
            2. Parsing CVSS vector string dynamically via cvss library
            3. Fallback string searching inside score
            4. UNKNOWN
        """

        # Priority 1: Direct string label from database_specific
        database_specific = payload.get("database_specific", {})
        severity = database_specific.get("severity")

        if severity:
            return self.normalize_severity(severity)

        # Priority 2: Parse items in the severity[] array
        severity_list = payload.get("severity", [])

        if isinstance(severity_list, list):
            for item in severity_list:
                if not isinstance(item, dict):
                    continue

                score_str = item.get("score", "")
                if not score_str:
                    continue

                # A. Try parsing CVSS Vector string using the official cvss library
                # parse_vector() supports CVSS v2, v3, and v4 vectors automatically!
                try:
                    cvss_objects = parse_vector(score_str)
                    if cvss_objects:
                        # cvss_objects contains parsed CVSS instances
                        # severities()[0] gives the qualitative severity ("Critical", "High", "Medium", "Low")
                        qualitative_severity = cvss_objects[0].severities()[0]
                        return self.normalize_severity(qualitative_severity)
                except Exception as e:
                    logger.debug(
                        f"[OSV Parser] Failed to parse CVSS vector string '{score_str}': {e}"
                    )

                # B. Fallback: Check for raw text keyword matching if vector parsing didn't match
                score_upper = score_str.upper()
                if "CRITICAL" in score_upper:
                    return "CRITICAL"
                if "HIGH" in score_upper:
                    return "HIGH"
                if "MEDIUM" in score_upper or "MODERATE" in score_upper:
                    return "MEDIUM"
                if "LOW" in score_upper:
                    return "LOW"

        return "UNKNOWN"

    def _extract_references(
        self,
        payload: dict,
    ) -> list[NormalizedReference]:

        refs = []

        references = payload.get("references", [])
        if not isinstance(references, list):
            return refs

        for ref in references:

            if not isinstance(ref, dict):
                continue

            url = ref.get("url")

            if not url:
                continue

            refs.append(
                NormalizedReference(
                    url=url
                )
            )

        return refs

    def _extract_tags(
        self,
        payload: dict,
    ) -> list[NormalizedTag]:

        tags = []

        affected_list = payload.get("affected", [])
        if not isinstance(affected_list, list):
            return tags

        for affected in affected_list:
            if not isinstance(affected, dict):
                continue

            package = affected.get("package", {})
            if not isinstance(package, dict):
                continue

            tech_name = package.get(
                "name",
                "unknown",
            )

            ecosystem = self.normalize_ecosystem(
                package.get(
                    "ecosystem",
                    "generic",
                )
            )

            ranges = affected.get("ranges", [])
            if not isinstance(ranges, list):
                ranges = []

            #
            # Package exists but version
            # information does not.
            #
            if not ranges:

                tags.append(
                    NormalizedTag(
                        tech_name=tech_name,
                        ecosystem=ecosystem,
                    )
                )

                continue

            #
            # Each package may have multiple
            # version ranges.
            #
            for version_range in ranges:
                if not isinstance(version_range, dict):
                    continue

                introduced = None
                fixed = None

                events = version_range.get(
                    "events",
                    [],
                )
                if not isinstance(events, list):
                    events = []

                for event in events:
                    if not isinstance(event, dict):
                        continue

                    if "introduced" in event:
                        introduced = str(
                            event["introduced"]
                        )

                    if "fixed" in event:
                        fixed = str(
                            event["fixed"]
                        )

                expression = None

                if introduced and fixed:
                    expression = (
                        f">={introduced} <{fixed}"
                    )

                elif introduced:
                    expression = (
                        f">={introduced}"
                    )

                elif fixed:
                    expression = (
                        f"<{fixed}"
                    )

                tags.append(
                    NormalizedTag(
                        tech_name=tech_name,
                        ecosystem=ecosystem,
                        introduced_version=introduced,
                        fixed_version=fixed,
                        raw_version_expression=expression,
                    )
                )

        return tags