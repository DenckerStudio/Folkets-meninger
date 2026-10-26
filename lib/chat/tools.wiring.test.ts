import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exitIfCiSkipsProdLive } from '@/lib/test/skip-in-ci-live';
import { createChatTools } from './tools';

exitIfCiSkipsProdLive('chat/tools.wiring.test.ts');

function resolveEnvTestFile(): string | null {
  const candidates = [
    process.env.CHAT_TEST_ENV_FILE,
    join(fileURLToPath(new URL('../../', import.meta.url)), '.env.test'),
    '/workspace/.env.test',
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      readFileSync(candidate, 'utf8');
      return candidate;
    } catch {
      // Try the next location.
    }
  }
  return null;
}

function loadFolketsPublicEnv(): boolean {
  const envFile = resolveEnvTestFile();
  if (!envFile) {
    console.warn('chat/tools.wiring.test.ts: no .env.test found — skipping live wiring checks');
    return false;
  }

  const text = readFileSync(envFile, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i);
    const value = line.slice(i + 1);
    if (key.startsWith('NEXT_PUBLIC_SUPABASE')) {
      process.env[key] = value;
    }
  }
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  return true;
}

function writeArtifact(name: string, payload: unknown): void {
  const dir = process.env.CHAT_TEST_ARTIFACT_DIR || join(tmpdir(), 'folkets-chat-artifacts');
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, name), JSON.stringify(payload, null, 2));
  } catch {
    // Artifacts are best-effort; never fail the wiring test on them.
  }
}

/**
 * Fake-provider-free overlay chat turn: invoke the production tools directly.
 * No mock chatbot UI. retrieveSakContext uses the public session/anon sak
 * cache, not the Cloud Agent service role. Personal tools use the
 * session-derived user id only — never a tool argument.
 */
async function main() {
  assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, undefined);
  const tools = createChatTools('200365');

  assert.equal(typeof tools.getPollResults.execute, 'function');
  assert.equal(typeof tools.getMyActivity.execute, 'function');
  assert.equal(typeof tools.getImpact.execute, 'function');
  assert.equal(typeof tools.getPublicProfile.execute, 'function');
  assert.equal(typeof tools.listMyNotifications.execute, 'function');
  assert.equal(typeof tools.getInnspillStatus.execute, 'function');
  assert.equal(typeof tools.findHearingsForSak.execute, 'function');
  assert.equal(typeof tools.getFolketsMeninger.execute, 'function');

  const retrieve = await tools.retrieveSakContext.execute(
    { issueId: '200365', query: 'vektgrense førerkort' },
    { toolCallId: 'retrieve-1', messages: [], abortSignal: undefined as never },
  );

  const spelling = await tools.helpRettsskriving.execute(
    {
      draft: 'Jeg meiner stortinget burde heve vektgrensen for førerkort klasse B.',
      context: 'motforslag',
    },
    { toolCallId: 'rett-1', messages: [], abortSignal: undefined as never },
  );

  const sources = await tools.searchUpdatedSources.execute(
    { query: 'Dokument 8:314 S førerkort vektgrense' },
    { toolCallId: 'searx-1', messages: [], abortSignal: undefined as never },
  );

  const listed = await tools.listMatchingSaker.execute(
    { query: 'vektgrense førerkort' },
    { toolCallId: 'list-1', messages: [], abortSignal: undefined as never },
  );

  // No session user id in this call — personal tools must fail closed.
  const activity = await tools.getMyActivity.execute(
    {},
    { toolCallId: 'activity-1', messages: [], abortSignal: undefined as never },
  );
  const profile = await tools.getPublicProfile.execute(
    {},
    { toolCallId: 'profile-1', messages: [], abortSignal: undefined as never },
  );
  // Service role is absent, so impact falls back to a grounded-less local estimate.
  const impact = await tools.getImpact.execute(
    { issueId: '200365' },
    { toolCallId: 'impact-1', messages: [], abortSignal: undefined as never },
  );

  const notifications = await tools.listMyNotifications.execute(
    {},
    { toolCallId: 'notifications-1', messages: [], abortSignal: undefined as never },
  );
  const innspill = await tools.getInnspillStatus.execute(
    { opinionId: 'does-not-matter' },
    { toolCallId: 'innspill-1', messages: [], abortSignal: undefined as never },
  );
  const hearings = await tools.findHearingsForSak.execute(
    { issueId: '200365' },
    { toolCallId: 'hearings-1', messages: [], abortSignal: undefined as never },
  );
  const meninger = await tools.getFolketsMeninger.execute(
    { issueId: '200365' },
    { toolCallId: 'meninger-1', messages: [], abortSignal: undefined as never },
  );

  assert.equal(notifications.signedIn, false);
  assert.deepEqual(notifications.items, []);
  assert.equal(innspill.found, false);
  assert.equal(innspill.signedIn, false);
  assert.ok(Array.isArray(hearings.hearings));
  for (const hearing of hearings.hearings) {
    assert.match(hearing.skriftligInnspillUrl, /stortinget\.no/);
  }
  assert.equal(typeof meninger.total, 'number');
  assert.deepEqual(activity.stanceSignals, { categories: [], labels: [] });
  assert.ok(impact.confidence);
  assert.ok(impact.source);
  if (!impact.source?.amountFromDocuments) {
    assert.equal(impact.result?.annualAmountKr, null);
  }

  assert.equal(spelling.context, 'motforslag');
  assert.match(spelling.instruction, /rettskriving|stavemåte|grammatikk/i);
  assert.equal(retrieve.issue?.id, '200365');
  assert.ok(retrieve.chunks.length > 0 || retrieve.summary);
  assert.ok(listed.issues.some((issue) => issue.id === '200365'));
  assert.equal(typeof sources.unavailable, 'boolean');
  assert.equal(activity.found, false);
  assert.equal(activity.signedIn, false);
  assert.equal(profile.found, false);
  assert.equal(profile.signedIn, false);
  assert.equal(impact.found, true);
  assert.ok(impact.result);

  const payload = {
    issueId: '200365',
    retrieve: {
      issueId: retrieve.issue?.id ?? null,
      chunkCount: retrieve.chunks.length,
      hasSummary: Boolean(retrieve.summary),
      note: retrieve.note,
    },
    rettskriving: {
      context: spelling.context,
      instructionOnly: spelling.mode === 'instruction' && spelling.corrected == null,
    },
    searxng: {
      unavailable: sources.unavailable,
      resultCount: Array.isArray(sources.results) ? sources.results.length : 0,
      titles: Array.isArray(sources.results)
        ? sources.results.slice(0, 3).map((hit: { title?: string }) => hit.title)
        : [],
    },
    personal: {
      activitySignedIn: activity.signedIn,
      profileSignedIn: profile.signedIn,
      impactGrounded: impact.result.grounded,
      impactConfidence: impact.result.confidence,
    },
  };

  writeArtifact('chat-tools-wiring.json', payload);
  console.log('chat/tools.wiring.test.ts: ok', JSON.stringify(payload.retrieve), 'searx', payload.searxng.resultCount);
}

if (loadFolketsPublicEnv()) {
  void main();
} else {
  console.log('chat/tools.wiring.test.ts: skipped live wiring (no env file)');
}
