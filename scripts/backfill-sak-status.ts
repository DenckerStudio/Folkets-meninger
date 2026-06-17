#!/usr/bin/env npx tsx
/**
 * One-off backfill: refresh stortinget_issues status from Stortinget detail API.
 *
 * Usage:
 *   npx tsx scripts/backfill-sak-status.ts
 *   npx tsx scripts/backfill-sak-status.ts --pending-only
 *   npx tsx scripts/backfill-sak-status.ts --concurrency 8
 */
import { getServiceSupabase } from '../lib/supabase';
import { refreshSakStatusOnly } from '../lib/stortinget-detail-cache';

const pendingOnly = process.argv.includes('--pending-only');
const concurrencyArg = process.argv.indexOf('--concurrency');
const concurrency =
  concurrencyArg >= 0 ? Math.max(1, Math.min(12, Number(process.argv[concurrencyArg + 1]) || 6)) : 6;

async function refreshOne(id: string) {
  try {
    const detail = await refreshSakStatusOnly(id);
    return { id, ok: Boolean(detail), ferdigbehandlet: detail?.ferdigbehandlet ?? null };
  } catch (err) {
    return {
      id,
      ok: false,
      ferdigbehandlet: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  const service = getServiceSupabase();

  let query = service.from('stortinget_issues').select('id').order('id', { ascending: true });
  if (pendingOnly) {
    query = query.eq('status', 'pending');
  }

  const { data: rows, error } = await query;
  if (error) throw error;
  if (!rows?.length) {
    console.log('No issues to refresh.');
    return;
  }

  const ids = rows.map((row) => String(row.id));
  console.log(`Refreshing ${ids.length} saker (concurrency ${concurrency})…`);

  let ok = 0;
  let failed = 0;

  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((id) => refreshOne(id)));

    for (const result of results) {
      if (result.ok) ok += 1;
      else {
        failed += 1;
        if ('error' in result && result.error) {
          console.warn(`  ${result.id}: ${result.error}`);
        }
      }
    }

    const done = Math.min(i + concurrency, ids.length);
    const last = results[results.length - 1];
    console.log(`  ${done}/${ids.length} — latest ${last.id}: ferdigbehandlet=${last.ferdigbehandlet}`);
  }

  const { data: counts } = await service.from('stortinget_issues').select('status');
  const summary = { pending: 0, closed: 0 };
  for (const row of counts ?? []) {
    if (row.status === 'pending') summary.pending += 1;
    if (row.status === 'closed') summary.closed += 1;
  }

  console.log(JSON.stringify({ refreshed: ok, failed, total: ids.length, dbStatus: summary }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
