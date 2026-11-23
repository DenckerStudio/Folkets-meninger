import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireAdmin } from '@/lib/admin/gate';
import {
  ABOUT_SUGGESTIONS_TABLE_MISSING_MESSAGE,
  aboutSuggestionsApiDeps,
  handleAboutSuggestionsList,
  handleAboutSuggestionsPost,
  type AboutSuggestionsApiDeps,
} from '@/lib/blog/about-suggestions-api';
import type { AboutSuggestion } from '@/lib/blog/about-suggestions';
import type { AboutSuggestionSourceBundle } from '@/lib/blog/about-suggestions-sources';
import type { AboutSuggestionStored } from '@/lib/blog/about-suggestions-store';

const suggestion: AboutSuggestion = {
  key: 'dekning:faq:representativitet',
  title: 'Er tallene representative for hele Norge?',
  angle: 'Tallene viser brukerne av tjenesten.',
  reason: 'Ofte stilte spørsmål har punktet, og ingen om-tittel tar det opp.',
  source: 'dekning',
  related: null,
  provenance: {},
  evergreen: false,
};

function stored(
  status: AboutSuggestionStored['status'] = 'open',
  extra: Partial<Pick<AboutSuggestionStored, 'draftRequestId' | 'sourceEvent'>> = {},
): AboutSuggestionStored {
  return {
    ...suggestion,
    status,
    snoozeUntil: null,
    draftRequestId: extra.draftRequestId ?? null,
    sourceEvent: extra.sourceEvent ?? null,
  };
}

function sources(): AboutSuggestionSourceBundle {
  return {
    written: [],
    changelog: [],
    roadmap: [],
    research: [],
    webHits: [],
    searxngConfigured: false,
    webError: null,
    cmsState: 'ok',
    notes: ['Nettsøk er ikke satt opp på serveren. Forslagene under bruker bare data vi allerede har.'],
  };
}

function makeDeps(overrides: Partial<AboutSuggestionsApiDeps> = {}): {
  deps: AboutSuggestionsApiDeps;
  calls: {
    lists: number;
    loads: number;
    plans: number;
    statuses: string[];
    lookups: number;
    reopens: string[];
  };
} {
  const calls = {
    lists: 0,
    loads: 0,
    plans: 0,
    statuses: [] as string[],
    lookups: 0,
    reopens: [] as string[],
  };
  const deps: AboutSuggestionsApiDeps = {
    requireAdmin: async () => ({ ok: true, userId: 'admin-1' }),
    listRows: async () => {
      calls.lists += 1;
      return { ok: true, rows: [stored()] };
    },
    loadSources: async () => {
      calls.loads += 1;
      return sources();
    },
    applyPlan: async () => {
      calls.plans += 1;
      return { ok: true };
    },
    setStatus: async (args) => {
      calls.statuses.push(args.status);
      return { ok: true };
    },
    prepare: () => ({
      visible: [suggestion],
      plan: { insert: [suggestion], update: [], deleteKeys: [] },
    }),
    lookupPost: async () => {
      calls.lookups += 1;
      return { found: false };
    },
    reopenOrphan: async (key) => {
      calls.reopens.push(key);
      return { ok: true };
    },
    searxngConfigured: () => false,
    now: () => new Date('2026-11-21T12:00:00.000Z'),
    ...overrides,
  };
  return { deps, calls };
}

function post(body: unknown): Request {
  return new Request('http://localhost/api/admin/blog/suggestions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function testGate() {
  for (const denied of [
    { ok: false as const, status: 401, error: 'Du må være logget inn' },
    { ok: false as const, status: 403, error: 'Ingen tilgang' },
  ]) {
    const { deps, calls } = makeDeps({ requireAdmin: async () => denied });
    const listed = await handleAboutSuggestionsList(deps);
    assert.equal(listed.status, denied.status);
    assert.deepEqual(listed.body, { error: denied.error });

    const refreshed = await handleAboutSuggestionsPost(post({ action: 'refresh' }), deps);
    assert.equal(refreshed.status, denied.status);
    assert.deepEqual(refreshed.body, { error: denied.error });

    const dismissed = await handleAboutSuggestionsPost(
      post({ action: 'dismiss', suggestion_key: suggestion.key }),
      deps,
    );
    assert.equal(dismissed.status, denied.status);
    assert.deepEqual(calls, { lists: 0, loads: 0, plans: 0, statuses: [], lookups: 0, reopens: [] });
  }

  const route = readFileSync(join(process.cwd(), 'app/api/admin/blog/suggestions/route.ts'), 'utf8');
  assert.match(route, /handleAboutSuggestionsList\(\)/);
  assert.match(route, /handleAboutSuggestionsPost\(request\)/);
  assert.equal(aboutSuggestionsApiDeps.requireAdmin, requireAdmin);
}

async function testListAndMissingTable() {
  const { deps } = makeDeps();
  const listed = await handleAboutSuggestionsList(deps);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.searxng_configured, false);
  assert.match(JSON.stringify(listed.body.notes), /Nettsøk er ikke satt opp/);
  const rows = listed.body.suggestions as Array<{ key: string; source_label: string }>;
  assert.equal(rows[0]?.key, suggestion.key);
  assert.equal(rows[0]?.source_label, 'Dekning');
  assert.doesNotMatch(JSON.stringify(listed.body), /research_topics/);

  const missing = makeDeps({
    listRows: async () => ({
      ok: false,
      missing: true,
      status: 503,
      message: ABOUT_SUGGESTIONS_TABLE_MISSING_MESSAGE,
    }),
  });
  const failed = await handleAboutSuggestionsList(missing.deps);
  assert.equal(failed.status, 503);
  assert.equal(failed.body.error, 'table_missing');
  assert.equal(failed.body.message, ABOUT_SUGGESTIONS_TABLE_MISSING_MESSAGE);

  const refreshMissing = await handleAboutSuggestionsPost(post({ action: 'refresh' }), missing.deps);
  assert.equal(refreshMissing.status, 503);
  assert.equal(refreshMissing.body.error, 'table_missing');
  assert.equal(missing.calls.loads, 0);
}

async function testRefreshAndFeedback() {
  const { deps, calls } = makeDeps();
  const refreshed = await handleAboutSuggestionsPost(post({ action: 'refresh' }), deps);
  assert.equal(refreshed.status, 200);
  assert.equal(calls.loads, 1);
  assert.equal(calls.plans, 1);
  assert.equal(refreshed.body.searxng_configured, false);

  const used = await handleAboutSuggestionsPost(
    post({ action: 'use', suggestion_key: suggestion.key }),
    deps,
  );
  assert.equal(used.status, 200);
  assert.deepEqual(calls.statuses, []);

  const snoozed = await handleAboutSuggestionsPost(
    post({ action: 'snooze', suggestion_key: suggestion.key }),
    deps,
  );
  assert.equal(snoozed.status, 200);
  assert.deepEqual(calls.statuses, ['snoozed']);

  const bad = await handleAboutSuggestionsPost(post({ action: 'dismiss', suggestion_key: 'X' }), deps);
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'invalid_input');
}

async function testOrphanUsedShowsAgain() {
  const orphan = stored('used');
  const { deps, calls } = makeDeps({
    listRows: async () => ({ ok: true, rows: [orphan] }),
    lookupPost: async () => ({ found: false }),
  });
  const listed = await handleAboutSuggestionsList(deps);
  assert.equal(listed.status, 200);
  const rows = listed.body.suggestions as Array<{ key: string }>;
  assert.equal(rows[0]?.key, suggestion.key);
  assert.deepEqual(calls.reopens, [suggestion.key]);
}

async function testRun() {
  await testGate();
  await testListAndMissingTable();
  await testRefreshAndFeedback();
  await testOrphanUsedShowsAgain();
  console.log('lib/blog/about-suggestions-api.test.ts ok');
}

void testRun().catch((error) => {
  console.error(error);
  process.exit(1);
});
