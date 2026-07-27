from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional


@dataclass(slots=True)
class NormalizedReference:
    """
    Represents a single external reference associated
    with a vulnerability.
    """

    url: str


@dataclass(slots=True)
class NormalizedTag:
    """
    Represents one affected technology/package.

    Example:
        Package: requests
        Ecosystem: PyPI
        Introduced: 2.18.0
        Fixed: 2.20.0
    """

    tech_name: str
    ecosystem: str

    introduced_version: Optional[str] = None
    fixed_version: Optional[str] = None
    raw_version_expression: Optional[str] = None


@dataclass(slots=True)
class NormalizedVulnerability:
    """
    Common in-memory representation of a vulnerability.

    Every vendor parser (NVD, GHSA, OSV, AWS, Docker...)
    converts its own payload into this model.

    After this point the processor layer becomes completely
    vendor agnostic.
    """

    display_id: str

    severity: str

    published_at: Optional[datetime]

    # Human-readable one-line summary.
    title: Optional[str] = None

    # Full advisory description / details text.
    description: Optional[str] = None

    # Numeric CVSS base score (0.0 – 10.0).
    cvss_score: Optional[float] = None

    # Raw CVSS vector string (e.g. CVSS:3.1/AV:N/AC:L/...).
    cvss_vector: Optional[str] = None

    # Alternative identifiers for the same vulnerability
    # (e.g. a GHSA advisory may also have a CVE alias).
    aliases: List[str] = field(default_factory=list)

    tags: List[NormalizedTag] = field(default_factory=list)

    references: List[NormalizedReference] = field(default_factory=list)