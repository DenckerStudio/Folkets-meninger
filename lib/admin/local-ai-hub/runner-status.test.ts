import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  RUNNER_STATUS_STALE_RUNNING_MS,
  formatRunnerOsloDateTime,
  formatRunnerTokS,
  isRunnerStatusStaleRunning,
  mapRunnerStatusToView,
  parseAndMapRunnerStatus,
  parseRunnerStatusPayload,
  serializeRunnerStatusForClient,
  fetchRunnerStatusFromUrl,
  type RunnerStatusPayload,
} from '@/lib/admin/local-ai-hub/runner-status';

const FAKE_URL = 'http://runner-status.test/status';

const NOW = Date.parse('2026-11-23T16:10:00+01:00');

function basePayload(overrides: Partial<RunnerStatusPayload> = {}): RunnerStatusPayload {
  return {
    updated_at: '2026-11-23T16:09:00+01:00',
    state: 'idle',
    pause_until: null,
    step: null,
    task: null,
    branch: null,
    pr: null,
    model: null,
    tok_s: null,
    last_run_at: null,
    ...overrides,
  };
}

describe('parseAndMapRunnerStatus', () => {
  it('idle → Ledig med valgfrie felt', () => {
    const raw = {
      updated_at: '2026-11-23T16:09:00+01:00',
      state: 'idle',
      pause_until: null,
      step: null,
      task: null,
      branch: null,
      pr: null,
      model: 'qwen3-coder:30b',
      tok_s: 12.3,
      last_run_at: '2026-11-23T15:42:00+01:00',
    };
    const view = parseAndMapRunnerStatus(raw, NOW);
    assert.equal(view.available, true);
    if (!view.available) return;
    assert.equal(view.statusLabel, 'Ledig');
    assert.equal(view.state, 'idle');
    assert.equal(view.model, 'qwen3-coder:30b');
    assert.equal(view.tokSLabel, formatRunnerTokS(12.3));
    assert.ok(view.lastRunAtLabel);
  });

  it('paused → Pause til HH:MM', () => {
    const view = mapRunnerStatusToView(
      basePayload({ state: 'paused', pause_until: '15:20' }),
      NOW,
    );
    assert.equal(view.available, true);
    if (!view.available) return;
    assert.equal(view.statusLabel, 'Pause til 15:20');
  });

  it('running med oppgave, steg, gren, PR, modell og tok/s', () => {
    const view = mapRunnerStatusToView(
      basePayload({
        state: 'running',
        step: 'koder',
        task: { id: 50, title: 'Fiks banner' },
        branch: 'lokal-ai/vikunja-50-fiks',
        pr: { number: 330, url: 'https://github.com/DenckerStudio/Folkets-meninger/pull/330' },
        model: 'qwen3-coder:30b',
        tok_s: 12,
        last_run_at: '2026-11-23T15:42:00+01:00',
      }),
      NOW,
    );
    assert.equal(view.available, true);
    if (!view.available) return;
    assert.equal(view.statusLabel, '#50 Fiks banner');
    assert.equal(view.step, 'koder');
    assert.equal(view.branch, 'lokal-ai/vikunja-50-fiks');
    assert.deepEqual(view.pr, {
      number: 330,
      url: 'https://github.com/DenckerStudio/Folkets-meninger/pull/330',
    });
    assert.equal(view.tokSLabel, '12 tok/s');
  });

  it('ugyldig JSON gir utilgjengelig', () => {
    assert.deepEqual(parseAndMapRunnerStatus(null), { available: false });
    assert.deepEqual(parseAndMapRunnerStatus({ state: 'bogus' }), { available: false });
  });

  it('utdatert running → utilgjengelig', () => {
    const staleAt = new Date(NOW - RUNNER_STATUS_STALE_RUNNING_MS - 1_000).toISOString();
    assert.equal(
      isRunnerStatusStaleRunning({ state: 'running', updated_at: staleAt }, NOW),
      true,
    );
    const view = mapRunnerStatusToView(
      basePayload({ state: 'running', updated_at: staleAt, step: 'plukker' }),
      NOW,
    );
    assert.deepEqual(view, { available: false });
  });

  it('klient-svar inneholder ikke runner-status-URL', () => {
    const serialized = JSON.stringify(
      serializeRunnerStatusForClient(
        mapRunnerStatusToView(
          basePayload({
            state: 'running',
            branch: 'lokal-ai/vikunja-1',
          }),
          NOW,
        ),
      ),
    );
    assert.doesNotMatch(serialized, /runner-status\.test/i);
    assert.doesNotMatch(serialized, /LOCAL_AI_RUNNER/i);
  });
});

describe('parseRunnerStatusPayload', () => {
  it('avviser ukjent steg', () => {
    assert.equal(
      parseRunnerStatusPayload({
        updated_at: '2026-11-23T16:09:00+01:00',
        state: 'running',
        step: 'deploy',
      }),
      null,
    );
  });
});

describe('formatRunnerOsloDateTime', () => {
  it('formaterer i Europe/Oslo', () => {
    const label = formatRunnerOsloDateTime('2026-11-23T15:42:00+01:00');
    assert.ok(label);
    assert.match(label!, /2026/);
  });
});

describe('fetchRunnerStatusFromUrl', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetch-feil → utilgjengelig uten lekkasje', async () => {
    const fetchFn = async () => {
      throw new Error('ECONNREFUSED at http://internal.example/status');
    };
    const result = await fetchRunnerStatusFromUrl(FAKE_URL, fetchFn);
    assert.deepEqual(result, { available: false });
    assert.doesNotMatch(JSON.stringify(result), /internal\.example/);
  });

  it('gyldig svar → view', async () => {
    const fetchFn = async (input: RequestInfo | URL) => {
      assert.equal(String(input), FAKE_URL);
      return new Response(
        JSON.stringify({
          updated_at: '2026-11-23T16:09:00+01:00',
          state: 'idle',
          pause_until: null,
          step: null,
          task: null,
          branch: null,
          pr: null,
          model: null,
          tok_s: null,
          last_run_at: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };
    const result = await fetchRunnerStatusFromUrl(FAKE_URL, fetchFn);
    assert.equal(result.available, true);
    if (!result.available) return;
    assert.equal(result.statusLabel, 'Ledig');
  });

  it('HTTP-feil → utilgjengelig', async () => {
    const fetchFn = async () => new Response('nope', { status: 503 });
    const result = await fetchRunnerStatusFromUrl(FAKE_URL, fetchFn);
    assert.deepEqual(result, { available: false });
  });
});