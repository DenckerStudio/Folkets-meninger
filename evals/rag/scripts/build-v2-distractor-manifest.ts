import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { v2CorpusConfigPath } from '../lib/v2-paths';

function loadSessions(): string[] {
  const cfg = JSON.parse(readFileSync(v2CorpusConfigPath(), 'utf8')) as {
    distractorSessionIds?: string[];
  };
  const fromCfg = cfg.distractorSessionIds;
  if (fromCfg?.length) return fromCfg;
  return ['2023-2024', '2024-2025', '2025-2026', '2026-2027'];
}

type ListRow = {
  id: number | string;
  korttittel?: string;
  tittel?: string;
  henvisning?: string;
  komite?: { navn?: string } | null;
};

async function fetchSessionSaker(sessionId: string): Promise<ListRow[]> {
  const url = `https://data.stortinget.no/eksport/saker?sesjonid=${encodeURIComponent(sessionId)}&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`saker ${sessionId}: ${res.status}`);
  const data = (await res.json()) as { saker_liste?: ListRow[] };
  return data.saker_liste ?? [];
}

async function main(): Promise<void> {
  const byId = new Map<string, Record<string, unknown>>();
  const SESSIONS = loadSessions();
  for (const sessionId of SESSIONS) {
    const rows = await fetchSessionSaker(sessionId);
    console.log(`[manifest] ${sessionId}: ${rows.length} saker`);
    for (const row of rows) {
      const id = String(row.id ?? '').trim();
      if (!id || byId.has(id)) continue;
      byId.set(id, {
        id,
        sessionId,
        korttittel: row.korttittel ?? row.tittel ?? '',
        tittel: row.tittel ?? row.korttittel ?? '',
        henvisning: row.henvisning ?? null,
        komite: row.komite?.navn ?? null,
      });
    }
  }

  const issues = [...byId.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const out = {
    generatedAt: new Date().toISOString(),
    sessions: loadSessions(),
    issueCount: issues.length,
    issues,
  };
  const path = join(process.cwd(), 'evals/rag/fixtures/corpus-v2-distractor-manifest.json');
  writeFileSync(path, JSON.stringify(out));
  console.log(`[manifest] wrote ${issues.length} issues to ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
