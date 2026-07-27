import logging

from ingestion.models import SourceAdvisory

from .base_parser import BaseParser
from .normalized_models import (
    NormalizedReference,
    NormalizedTag,
    NormalizedVulnerability,
)

logger = logging.getLogger("ingestion_logger")


class NVDParser(BaseParser):
    """
    Parser for NVD CVE JSON payloads.

    Converts raw NVD schema into the common
    NormalizedVulnerability model.
    """

    def parse(self, advisory: SourceAdvisory) -> NormalizedVulnerability:

        logger.info(
            f"[NVD Parser] Parsing advisory '{advisory.external_id}'..."
        )

        payload = advisory.raw_payload or {}

        cve = payload.get("cve", {})

        display_id = cve.get("id") or advisory.external_id

        self.validate_display_id(display_id)

        severity = self._extract_severity(cve)

        published_at = self.parse_iso_date(
            cve.get("published")
        )

        title = self._extract_title(cve)
        description = self._extract_description(cve)

        cvss_score, cvss_vector = self._extract_cvss(cve)

        # If we extracted a numeric score but severity came back
        # UNKNOWN, derive severity from the score.
        if severity == "UNKNOWN" and cvss_score is not None:
            severity = self._severity_from_score(cvss_score)

        references = self._extract_references(cve)

        tags = self._extract_tags(cve)

        logger.info(
            f"[NVD Parser] Parsed '{display_id}' "
            f"({len(tags)} tags, {len(references)} references)."
        )

        return NormalizedVulnerability(
            display_id=display_id,
            severity=severity,
            published_at=published_at,
            title=title,
            description=description,
            cvss_score=cvss_score,
            cvss_vector=cvss_vector,
            tags=tags,
            references=references,
        )

    # ----------------------------------------------------------
    # Private Helpers
    # ----------------------------------------------------------

    def _extract_title(self, cve: dict) -> str | None:
        """
        NVD doesn't have a dedicated title field.
        Use the first 200 chars of the English description
        as a summary/title.
        """
        desc = self._extract_description(cve)
        if not desc:
            return None
        return desc[:200] if len(desc) > 200 else desc

    def _extract_description(self, cve: dict) -> str | None:
        """
        Extracts the English-language description text
        from the NVD descriptions array.
        """
        descriptions = cve.get("descriptions", [])
        if not isinstance(descriptions, list):
            return None

        for desc in descriptions:
            if not isinstance(desc, dict):
                continue
            if desc.get("lang", "").startswith("en"):
                return desc.get("value")

        # Fallback: first description regardless of language
        if descriptions and isinstance(descriptions[0], dict):
            return descriptions[0].get("value")

        return None

    def _extract_severity(self, cve: dict) -> str:
        """
        Extracts severity from the newest available
        CVSS version.
        """

        metrics = cve.get("metrics", {})

        versions = [
            "cvssMetricV40",
            "cvssMetricV31",
            "cvssMetricV30",
            "cvssMetricV2",
        ]

        for version in versions:

            metric = metrics.get(version)

            if not metric:
                continue

            if not isinstance(metric, list):
                continue

            if not metric:
                continue

            cvss = metric[0].get("cvssData", {})

            severity = cvss.get("baseSeverity")

            if severity:
                return self.normalize_severity(severity)

        return "UNKNOWN"

    def _extract_cvss(self, cve: dict) -> tuple[float | None, str | None]:
        """
        Extracts numeric CVSS base score and vector string
        from the newest available CVSS version.
        """
        metrics = cve.get("metrics", {})

        versions = [
            "cvssMetricV40",
            "cvssMetricV31",
            "cvssMetricV30",
            "cvssMetricV2",
        ]

        for version in versions:
            metric = metrics.get(version)
            if not metric or not isinstance(metric, list) or not metric:
                continue

            cvss = metric[0].get("cvssData", {})
            score = cvss.get("baseScore")
            vector = cvss.get("vectorString")

            if score is not None:
                try:
                    return float(score), vector
                except (ValueError, TypeError):
                    pass

        return None, None

    @staticmethod
    def _severity_from_score(score: float) -> str:
        """Derive a severity label from a CVSS numeric score."""
        if score >= 9.0:
            return "CRITICAL"
        if score >= 7.0:
            return "HIGH"
        if score >= 4.0:
            return "MEDIUM"
        if score > 0.0:
            return "LOW"
        return "UNKNOWN"

    def _extract_references(
        self,
        cve: dict,
    ) -> list[NormalizedReference]:

        refs = []

        references = cve.get("references", [])
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
        cve: dict,
    ) -> list[NormalizedTag]:

        tags = []

        configurations = cve.get(
            "configurations",
            [],
        )
        if not isinstance(configurations, list):
            return tags

        for configuration in configurations:
            if not isinstance(configuration, dict):
                continue

            nodes = configuration.get("nodes", [])
            if not isinstance(nodes, list):
                continue

            for node in nodes:
                if not isinstance(node, dict):
                    continue

                cpe_matches = node.get("cpeMatch", [])
                if not isinstance(cpe_matches, list):
                    continue

                for match in cpe_matches:
                    if not isinstance(match, dict):
                        continue

                    cpe = match.get(
                        "criteria",
                        ""
                    )

                    ecosystem, tech_name = self.extract_cpe(cpe)

                    # Extract structured version ranges from
                    # NVD's cpeMatch version fields.
                    introduced = (
                        match.get("versionStartIncluding")
                        or match.get("versionStartExcluding")
                    )
                    fixed = (
                        match.get("versionEndExcluding")
                        or match.get("versionEndIncluding")
                    )

                    # Build a human-readable version expression.
                    version_expr = self._build_version_expression(match)

                    tags.append(
                        NormalizedTag(
                            tech_name=tech_name,
                            ecosystem=ecosystem,
                            introduced_version=str(introduced) if introduced else None,
                            fixed_version=str(fixed) if fixed else None,
                            raw_version_expression=version_expr,
                        )
                    )

        return tags

    @staticmethod
    def _build_version_expression(match: dict) -> str | None:
        """
        Builds a human-readable version range from NVD
        cpeMatch version boundary fields instead of storing
        the raw CPE string (which is a product identifier,
        not a version range).
        """
        parts = []

        start_inc = match.get("versionStartIncluding")
        start_exc = match.get("versionStartExcluding")
        end_inc = match.get("versionEndIncluding")
        end_exc = match.get("versionEndExcluding")

        if start_inc:
            parts.append(f">={start_inc}")
        elif start_exc:
            parts.append(f">{start_exc}")

        if end_exc:
            parts.append(f"<{end_exc}")
        elif end_inc:
            parts.append(f"<={end_inc}")

        return " ".join(parts) if parts else None