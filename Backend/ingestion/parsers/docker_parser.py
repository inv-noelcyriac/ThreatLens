# ingestion/parsers/docker_parser.py

import logging

from .nvd_parser import NVDParser

logger = logging.getLogger("ingestion_logger")


class DockerParser(NVDParser):
    """
    Docker Ecosystem parser.

    The Docker Ecosystem worker currently stores NVD CVE JSON.
    Since the schema is identical to NVD, we simply inherit the
    production-tested NVD parser.

    If Docker later publishes its own JSON schema,
    this parser can be overridden without affecting
    the rest of the normalization pipeline.
    """

    pass