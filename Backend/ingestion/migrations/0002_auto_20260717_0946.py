from django.db import migrations

def merge_and_deduplicate_docker_sources(apps, schema_editor):
    SourceAdvisory = apps.get_model('ingestion', 'SourceAdvisory')
    
    # We map the old source name to the new one
    OLD_SOURCE = 'docker_core_cpe'
    NEW_SOURCE = 'docker_ecosystem'

    # 1. Find all old advisories
    old_advisories = SourceAdvisory.objects.filter(source=OLD_SOURCE)

    for old_adv in old_advisories:
        # 2. Check if the new ecosystem task already fetched this exact CVE
        exists_in_new = SourceAdvisory.objects.filter(
            source=NEW_SOURCE, 
            external_id=old_adv.external_id
        ).exists()

        if exists_in_new:
            # If the new stream already pulled it, delete the old legacy record safely
            old_adv.delete()
        else:
            # If it's a unique old record, change its source to the new name so we keep it
            old_adv.source = NEW_SOURCE
            old_adv.save()

def rollback_docker_sources(apps, schema_editor):
    # Optional reverse logic (reverts the source names back if you roll back the migration)
    SourceAdvisory = apps.get_model('ingestion', 'SourceAdvisory')
    SourceAdvisory.objects.filter(source='docker_ecosystem').update(source='docker_core_cpe')

class Migration(migrations.Migration):

    dependencies = [
        # This list will already have your previous migration. Keep whatever Django put here!
        ('ingestion', '0001_initial'), 
    ]

    operations = [
        migrations.RunPython(merge_and_deduplicate_docker_sources, reverse_code=rollback_docker_sources),
    ]