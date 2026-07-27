import logging

from ingestion.models import SourceAdvisory

from .osv_parser import OSVParser

logger = logging.getLogger("ingestion_logger")


class GHSAParser(OSVParser):
    """
    Parser for GitHub Security Advisories.

    GHSA follows the OSV schema almost entirely.

    The only enhancement here is that we prefer
    a CVE alias over the GHSA identifier whenever
    one exists.
    """

    def parse(self, advisory: SourceAdvisory):

        vulnerability = super().parse(advisory)

        payload = advisory.raw_payload or {}

        aliases = payload.get("aliases", [])

        #
        # Prefer CVE as canonical identifier.
        #
        for alias in aliases:

            if alias.upper().startswith("CVE-"):

                logger.info(
                    f"[GHSA Parser] Using CVE alias "
                    f"'{alias}' instead of "
                    f"'{vulnerability.display_id}'."
                )

                vulnerability.display_id = alias

                break

        return vulnerability