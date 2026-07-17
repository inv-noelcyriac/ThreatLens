import xml.etree.ElementTree as ET
import logging
from ingestion.tasks import BaseIngestionTask

logger = logging.getLogger('ingestion_logger')

class AWSIngestionTask(BaseIngestionTask):
    """
    Worker task dedicated to extracting, structuralizing, and storing
    vulnerability metrics directly from the AWS Security Alerts feed.
    """
    source_name = 'aws'
    # Live RSS feed for Amazon Web Services security notifications
    target_url = 'https://aws.amazon.com/security/security-bulletins/rss/feed/'
    
    # Structural keys expected by downstream processors
    required_keys = ['title', 'link', 'description', 'pubDate']

    def run(self):
        """Executes the ingestion run loop for the AWS Security feed."""
        logger.info("[AWS] Starting ingestion run loop...")
        
        try:
            # 1. Fetch raw XML using the inherited full jitter backoff loop
            raw_xml = self.fetch_with_retry()
            
            # 2. Unpack the XML structure safely
            root = ET.fromstring(raw_xml)
            items = root.findall('.//item')
            logger.info(f"[AWS] Found {len(items)} security advisories to evaluate.")
            
            for item in items:
                title = item.findtext('title', '').strip()
                link = item.findtext('link', '').strip()
                description = item.findtext('description', '').strip()
                pub_date = item.findtext('pubDate', '').strip()
                
                # Derive our unique identifier from the trailing URL snippet
                external_id = link.rstrip('/').split('/')[-1]
                
                if not external_id:
                    logger.warning("[AWS] Skipping item due to missing link identifier generation capacity.")
                    continue
                
                advisory_payload = {
                    'title': title,
                    'link': link,
                    'description': description,
                    'pubDate': pub_date
                }
                
                # 3. Submit directly to parent database handling layers
                self.save_advisory(external_id=external_id, raw_payload=advisory_payload)
                
            logger.info("[AWS] Ingestion pipeline run loop completed cleanly.")
            
        except Exception as e:
            logger.error(f"[AWS] PIPELINE CRASHED. Detailed Error Trace: {str(e)}")