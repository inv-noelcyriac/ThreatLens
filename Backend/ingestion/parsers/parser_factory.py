import logging
from typing import Type

from .base_parser import BaseParser
from .nvd_parser import NVDParser
from .ghsa_parser import GHSAParser
from .osv_parser import OSVParser
from .aws_parser import AWSParser
from .docker_parser import DockerParser

logger = logging.getLogger("ingestion_logger")


class ParserFactory:
    """
    Factory responsible for returning the correct parser
    implementation for a given source.

    The normalization pipeline never directly instantiates
    vendor parsers. It simply asks the factory for one.

    NOTE: We store *classes*, not instances, so that every
    call gets a fresh parser.  This eliminates any risk of
    shared mutable state between advisories or threads.
    """

    _PARSERS: dict[str, Type[BaseParser]] = {
        "nvd": NVDParser,
        "ghsa": GHSAParser,
        "osv": OSVParser,
        "aws": AWSParser,
        "docker_ecosystem": DockerParser,
        "docker_hardened_osv": OSVParser,
    }

    @classmethod
    def get_parser(cls, source: str) -> BaseParser:
        """
        Returns a fresh parser instance for the supplied source.

        Args:
            source: Vendor source name stored in source_advisories.source

        Raises:
            ValueError:
                If no parser is registered for the supplied source.
        """

        if not source:
            raise ValueError("ParserFactory received an empty source name.")

        parser_cls = cls._PARSERS.get(source.lower())

        if parser_cls is None:
            logger.error(
                f"No parser registered for source '{source}'."
            )
            raise ValueError(
                f"No parser registered for source '{source}'."
            )

        parser = parser_cls()

        logger.info(
            f"Selected parser '{parser.__class__.__name__}' for source '{source}'."
        )

        return parser