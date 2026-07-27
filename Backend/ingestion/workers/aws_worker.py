import logging
import os
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

from django.utils import timezone

from ingestion.tasks import BaseIngestionTask

logger = logging.getLogger("ingestion_logger")


class AWSIngestionTask(BaseIngestionTask):
    """
    Worker task dedicated to extracting, structuralizing, and storing
    vulnerability metrics directly from the AWS Security Alerts feed.
    Supports incremental delta syncs using SyncState checkpoints.
    """

    source_name: str = "aws"
    required_keys = ["title", "link", "description", "pubDate"]

    def run(self) -> None:
        """Executes the incremental ingestion run loop for the AWS Security feed."""
        logger.info("[AWS] Initializing AWS Security Alerts ingestion task...")

        # 1. Fetch latest successful baseline timestamp checkpoint
        last_checkpoint = self.get_last_checkpoint()

        # 2. Create the SINGLE tracking row in RUNNING state
        sync_record = self.record_start(last_checkpoint=last_checkpoint)

        target_url = os.environ.get("AWS_RSS_URL")
        if not target_url:
            error_msg = "AWS_RSS_URL environment variable is missing."
            logger.error(f"[AWS] {error_msg}")
            # Mutate active row to FAILED
            self.record_failure(sync_record=sync_record, error_message=error_msg)
            return

        if last_checkpoint:
            logger.info(f"[AWS] Incremental sync baseline checkpoint: {last_checkpoint}")
        else:
            logger.info("[AWS] No previous checkpoint found. Performing full sync.")

        records_processed = 0
        newest_item_timestamp = last_checkpoint

        try:
            # 3. Fetch raw XML payload
            raw_xml = self.fetch_with_retry(target_url=target_url)
            if not raw_xml:
                error_msg = "Raw XML payload is empty or None."
                logger.error(f"[AWS] {error_msg}")
                # Mutate active row to FAILED
                self.record_failure(sync_record=sync_record, error_message=error_msg)
                return

            # 4. Unpack XML structure safely
            root = ET.fromstring(raw_xml)
            items = root.findall(".//item")
            logger.info(f"[AWS] Found {len(items)} security advisories to evaluate.")

            for item in items:
                title = item.findtext("title", "").strip()
                link = item.findtext("link", "").strip()
                description = item.findtext("description", "").strip()
                pub_date_str = item.findtext("pubDate", "").strip()

                # Derive external identifier from trailing URL snippet
                external_id = link.rstrip("/").split("/")[-1]
                if not external_id:
                    logger.warning("[AWS] Skipping item due to missing link identifier.")
                    continue

                # Parse pubDate (RFC 2822 format) into timezone-aware datetime
                item_pub_date = None
                if pub_date_str:
                    try:
                        parsed_dt = parsedate_to_datetime(pub_date_str)
                        item_pub_date = (
                            timezone.make_aware(parsed_dt)
                            if timezone.is_naive(parsed_dt)
                            else parsed_dt
                        )
                    except Exception as date_err:
                        logger.warning(
                            f"[AWS] Could not parse pubDate '{pub_date_str}': {date_err}"
                        )

                # INCREMENTAL FILTERING CHECK: Skip items older than or equal to checkpoint
                if last_checkpoint and item_pub_date and item_pub_date <= last_checkpoint:
                    continue

                advisory_payload = {
                    "title": title,
                    "link": link,
                    "description": description,
                    "pubDate": pub_date_str,
                }

                # Save raw payload to SourceAdvisory table
                self.save_advisory(external_id=external_id, raw_payload=advisory_payload)
                records_processed += 1

                # Update running highest timestamp tracker
                if item_pub_date:
                    if (
                        newest_item_timestamp is None
                        or item_pub_date > newest_item_timestamp
                    ):
                        newest_item_timestamp = item_pub_date

            final_sync_time = newest_item_timestamp or last_checkpoint or timezone.now()

            # 5. Mutate active row to SUCCESS
            self.record_success(
                sync_record=sync_record,
                records_processed=records_processed,
                sync_time=final_sync_time,
            )

            logger.info(
                f"[AWS] Ingestion pipeline completed cleanly. "
                f"Processed {records_processed} new records. New checkpoint: {final_sync_time}"
            )

        except Exception as e:
            error_trace = f"PIPELINE CRASHED: {str(e)}"
            logger.error(f"[AWS] {error_trace}")
            # Mutate active row to FAILED
            self.record_failure(sync_record=sync_record, error_message=error_trace)