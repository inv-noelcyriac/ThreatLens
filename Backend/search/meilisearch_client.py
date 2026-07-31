# search/meilisearch_client.py
import logging
import meilisearch
from django.conf import settings

logger = logging.getLogger("ingestion_logger")

INDEX_NAME = "vulnerabilities"


def get_meilisearch_client() -> meilisearch.Client:
    """Returns an authenticated Meilisearch client instance."""
    url = getattr(settings, "MEILISEARCH_URL", "http://127.0.0.1:7700")
    api_key = getattr(settings, "MEILISEARCH_MASTER_KEY", "masterKey")
    return meilisearch.Client(url, api_key)


def configure_vulnerabilities_index():
    """
    Initializes the 'vulnerabilities' index with primary key 'id'
    and configures settings based on TL-302.
    """
    client = get_meilisearch_client()

    # Ensure index exists with primary_key='id'
    try:
        client.create_index(uid=INDEX_NAME, options={"primaryKey": "id"})
    except meilisearch.errors.MeilisearchApiError:
        # Index already exists; update primary key explicitly
        client.index(INDEX_NAME).update(primary_key="id")

    index = client.index(INDEX_NAME)

    logger.info(f"[MEILISEARCH] Configuring settings for index '{INDEX_NAME}'...")

    # 1. Searchable Attributes
    index.update_searchable_attributes([
        "display_id",
        "filter_tech_names",
        "descriptions",
    ])

    # 2. Filterable Attributes
    index.update_filterable_attributes([
        "severity",
        "filter_tech_names",
        "filter_ecosystems",
        "filter_comp_matrix",
        "published_at",
        "is_hidden"
    ])

    # 3. Sortable Attributes
    index.update_sortable_attributes([
        "published_at",
        "severity",
        "cvss_score",
    ])

    # 4. Disable Typo Tolerance
    index.update_typo_tolerance({
        "disableOnAttributes": [
            "display_id",
            "filter_tech_names",
            "filter_comp_matrix",
        ]
    })

    logger.info(f"[MEILISEARCH] Index '{INDEX_NAME}' configuration task submitted successfully.")
    return index