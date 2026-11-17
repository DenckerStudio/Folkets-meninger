import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FRICTION_VERDICT_FIXTURES,
  PIXEL_VERDICT_FIXTURES,
} from '@/lib/admin/local-ai-hub/verdict-parser-fixtures';
import {
  isTrustedVerdictComment,
  parseVerdictsFromComments,
} from '@/lib/admin/local-ai-hub/verdict-parser';

const HEAD = 'abc123def4567890abcdef1234567890abcdef12';
const OWNER = 'OWNER';

describe('isTrustedVerdictComment', () => {
  it('godtar OWNER, MEMBER og COLLABORATOR', () => {
    assert.equal(isTrustedVerdictComment('OWNER'), true);
    assert.equal(isTrustedVerdictComment('MEMBER'), true);
    assert.equal(isTrustedVerdictComment('collaborator'), true);
  });

  it('avviser CONTRIBUTOR og NONE', () => {
    assert.equal(isTrustedVerdictComment('CONTRIBUTOR'), false);
    assert.equal(isTrustedVerdictComment('NONE'), false);
    assert.equal(isTrustedVerdictComment(null), false);
  });
});

describe('parseVerdictsFromComments', () => {
  for (const fixture of PIXEL_VERDICT_FIXTURES) {
    it(`gjenkjenner Pixel fra PR #${fixture.pr}`, () => {
      const v = parseVerdictsFromComments(
        [{ body: fixture.body, created_at: '2026-01-01T00:00:00Z', author_association: OWNER }],
        fixture.headSha,
      );
      assert.equal(v.pixel, fixture.outcome);
    });
  }

  for (const fixture of FRICTION_VERDICT_FIXTURES) {
    it(`gjenkjenner Friction fra PR #${fixture.pr}`, () => {
      const v = parseVerdictsFromComments(
        [{ body: fixture.body, created_at: '2026-01-01T00:00:00Z', author_association: OWNER }],
        fixture.headSha,
      );
      assert.equal(v.friction, fixture.outcome);
    });
  }

  it('ignorerer verdict fra ikke-trusted association', () => {
    const v = parseVerdictsFromComments(
      [
        {
          body: '**Pixel UI PASS @ abc123d**',
          created_at: '2026-01-02T00:00:00Z',
          author_association: 'CONTRIBUTOR',
        },
      ],
      HEAD,
    );
    assert.equal(v.pixel, 'unknown');
  });

  it('velger første verdict i brødteksten (PASS før FAIL i samme kommentar)', () => {
    const v = parseVerdictsFromComments(
      [
        {
          body: `**Pixel UI PASS @ abc123d**\n\nre-review (mot min Pixel UI FAIL @ ff00ff0)`,
          created_at: '2026-01-02T00:00:00Z',
          author_association: OWNER,
        },
      ],
      HEAD,
    );
    assert.equal(v.pixel, 'pass');
  });

  it('nyeste trusted kommentar vinner på tvers av kommentarer', () => {
    const v = parseVerdictsFromComments(
      [
        {
          body: 'Pixel UI PASS @ abc123def4567890abcdef1234567890abcdef12',
          created_at: '2026-01-01T00:00:00Z',
          author_association: OWNER,
        },
        {
          body: 'Pixel UI FAIL @ abc123def4567890abcdef1234567890abcdef12',
          created_at: '2026-01-02T00:00:00Z',
          author_association: OWNER,
        },
      ],
      HEAD,
    );
    assert.equal(v.pixel, 'fail');
  });
});