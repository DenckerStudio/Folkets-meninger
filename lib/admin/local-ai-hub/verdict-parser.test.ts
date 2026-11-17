import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseVerdictsFromComments } from '@/lib/admin/local-ai-hub/verdict-parser';

const HEAD = 'abc123def4567890abcdef1234567890abcdef12';

describe('parseVerdictsFromComments', () => {
  it('matcher nyeste PASS for Pixel og Friction når SHA stemmer', () => {
    const comments = [
      {
        body: '**Pixel UI PASS @ abc123d**',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        body: '**Friction UX: PASS @ `abc123def456`**',
        created_at: '2026-01-02T00:00:00Z',
      },
      {
        body: 'Pixel UI FAIL @ deadbeef',
        created_at: '2026-01-03T00:00:00Z',
      },
    ];
    const v = parseVerdictsFromComments(comments, HEAD);
    assert.equal(v.pixel, 'unknown');
    assert.equal(v.friction, 'pass');
  });

  it('ignorerer eldre PASS når nyeste ikke matcher head', () => {
    const comments = [
      {
        body: 'Pixel UI PASS @ abc123def4567890abcdef1234567890abcdef12',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        body: 'Pixel UI FAIL @ abc123def4567890abcdef1234567890abcdef12',
        created_at: '2026-01-02T00:00:00Z',
      },
    ];
    const v = parseVerdictsFromComments(comments, HEAD);
    assert.equal(v.pixel, 'fail');
  });

  it('returnerer unknown når nyeste kommentar har feil SHA', () => {
    const comments = [
      {
        body: 'Pixel UI PASS @ ff00ff0',
        created_at: '2026-01-02T00:00:00Z',
      },
    ];
    const v = parseVerdictsFromComments(comments, HEAD);
    assert.equal(v.pixel, 'unknown');
  });

  it('støtter Friction FAIL uten ekstra markdown', () => {
    const comments = [
      {
        body: 'Friction UX: FAIL @ abc123d',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    const v = parseVerdictsFromComments(comments, HEAD);
    assert.equal(v.friction, 'fail');
  });
});