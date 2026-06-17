import { getServiceSupabase } from '../lib/supabase';
import { getSakDetail } from '../lib/stortinget';
import { ingestSakDocuments } from '../lib/stortinget-document-ingest';

const limit = Number(process.argv[2] || 10);

async function main() {
  const service = getServiceSupabase();
  const { data: issues, error } = await service
    .from('stortinget_issues')
    .select('id')
    .order('last_synced_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  let processed = 0;
  for (const issue of issues ?? []) {
    const detail = await getSakDetail(String(issue.id), { nextRevalidateSeconds: 3600 });
    if (!detail) continue;
    const result = await ingestSakDocuments(String(issue.id), detail);
    processed += 1;
    console.log(`Sak ${issue.id}:`, result);
  }

  console.log(`Backfill complete for ${processed} saker.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
