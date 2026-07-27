import logging
import re

from bs4 import BeautifulSoup

from ingestion.models import SourceAdvisory

from .base_parser import BaseParser
from .normalized_models import (
    NormalizedReference,
    NormalizedTag,
    NormalizedVulnerability,
)

logger = logging.getLogger("ingestion_logger")


class AWSParser(BaseParser):
    """
    Parser for native AWS Security Bulletin RSS payloads.
    """

    def parse(self, advisory: SourceAdvisory) -> NormalizedVulnerability:

        logger.info(
            f"[AWS Parser] Parsing advisory '{advisory.external_id}'..."
        )

        payload = advisory.raw_payload or {}

        description = payload.get("description", "")

        soup = BeautifulSoup(description, "html.parser")

        text = soup.get_text("\n")

        display_id = (
            self._extract_bulletin_id(text)
            or advisory.external_id
        )

        self.validate_display_id(display_id)

        severity = self._extract_severity(text)

        published_at = self.parse_iso_date(
            payload.get("pubDate")
        )

        references = self._extract_references(payload)

        tags = self._extract_tags(text, payload.get("title", ""))

        logger.info(
            f"[AWS Parser] Parsed '{display_id}' "
            f"({len(tags)} tags, {len(references)} references)"
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

    def _extract_bulletin_id(
        self,
        text: str,
    ) -> str | None:

        match = re.search(
            r"Bulletin ID:\s*(.+)",
            text,
            re.IGNORECASE,
        )

        if match:
            return match.group(1).strip()

        return None

    def _extract_severity(
        self,
        text: str,
    ) -> str:

        match = re.search(
            r"Content Type:\s*(.+)",
            text,
            re.IGNORECASE,
        )

        if not match:
            return "UNKNOWN"

        value = match.group(1).strip().lower()

        #
        # AWS RSS does not use CVSS terminology.
        #
        if "critical" in value:
            return "CRITICAL"

        if "important" in value:
            return "HIGH"

        if "warning" in value:
            return "MEDIUM"

        if "information" in value:
            return "LOW"

        return "UNKNOWN"

    def _extract_references(
        self,
        payload: dict,
    ) -> list[NormalizedReference]:

        refs = []

        url = payload.get("link")

        if url:

            refs.append(
                NormalizedReference(
                    url=url
                )
            )

        return refs

    def _extract_tags(
        self,
        text: str,
        title: str = "",
    ) -> list[NormalizedTag]:

        tags = []

        match = re.search(
            r"Resolution:\s*(.+)",
            text,
            re.IGNORECASE,
        )

        if not match:
            return tags

        resolution = match.group(1).strip()

        #
        # Example:
        #
        # Kiro IDE <0.6.18
        #
        version_match = re.search(
            r"(.+?)\s*([<>]=?.+)",
            resolution,
        )

        if version_match:

            tech_name = version_match.group(1).strip()

            version_expr = version_match.group(2).strip()

        else:
            # If resolution is a long paragraph/sentence (>100 characters),
            # parse the title to extract a clean product name.
            if len(resolution) > 100:
                tech_name = self._extract_product_from_title(title)
            else:
                tech_name = resolution

            version_expr = None

        tags.append(
            NormalizedTag(
                tech_name=tech_name,
                ecosystem="aws",
                raw_version_expression=version_expr,
            )
        )

        return tags

    def _extract_product_from_title(self, title: str) -> str:
        """
        Parses bulletin title to extract clean product name.
        E.g., "[Redirected] Memory Dump Issue in AWS CodeBuild" -> "AWS CodeBuild"
        E.g., "Unanchored ACCOUNT_ID webhook filters for CodeBuild" -> "CodeBuild"
        """
        if not title:
            return "AWS Service"

        # 1. Strip common prefixes like "[Redirected] ", "CVE-xxxx-xxxx - "
        clean_title = re.sub(r"^\[[^\]]+\]\s*", "", title)
        clean_title = re.sub(r"^CVE-\d+-\d+\s*-\s*", "", clean_title, flags=re.IGNORECASE)
        clean_title = clean_title.strip()

        # 2. Look for patterns in title: " in <Product>", " for <Product>"
        for pattern in [r"\bin\s+(.+)$", r"\bfor\s+(.+)$"]:
            match = re.search(pattern, clean_title, re.IGNORECASE)
            if match:
                product = match.group(1).strip()
                # Clean trailing helper words
                product = re.sub(r"\s+repositories?$", "", product, flags=re.IGNORECASE)
                product = re.sub(r"\s+vulnerability$", "", product, flags=re.IGNORECASE)
                if product:
                    return product

        # 3. Fallback
        return clean_title if len(clean_title) < 50 else "AWS Service"