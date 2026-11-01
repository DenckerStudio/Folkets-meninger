import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  classifySakSummaryHttpResponse,
  parseReadySakSummary,
  publicSakSummaryLead,
  retryAfterSeconds,
  sakSummaryReadyFromStored,
  SAK_SUMMARY_READ_FAILED_MESSAGE,
  SAK_SUMMARY_TIMEOUT_MESSAGE,
} from '@/lib/ai-summary/sak-summary-fetch';
import type { AiSummary } from '@/lib/ai-summary/types';

assert.equal(
  classifySakSummaryHttpResponse(503, { status: 'read_failed', retry_after_seconds: 15 }),
  'read_failed',
);
assert.equal(classifySakSummaryHttpResponse(202, { status: 'pending' }), 'pending');
assert.equal(classifySakSummaryHttpResponse(500, { error: 'x' }), 'unexpected');

const ready = parseReadySakSummary({
  version: 2,
  narrative: 'Tekst',
  who_affected: '',
  how_affected: '',
  forslag: [],
  topic_cards: [],
  labels: [],
});
assert.ok(ready?.version === 2);

assert.equal(retryAfterSeconds({ retry_after_seconds: 30 }), 30);
assert.equal(retryAfterSeconds({}), 15);

const uiSrc = readFileSync(
  join(process.cwd(), 'app/dashboard/sak/[id]/ai-summary.tsx'),
  'utf8',
);
assert.match(uiSrc, /SAK_SUMMARY_READ_FAILED_MESSAGE/);
assert.match(uiSrc, /Prøv igjen/);
assert.match(uiSrc, /SAK_SUMMARY_TIMEOUT_MESSAGE/);
assert.match(uiSrc, /classifySakSummaryHttpResponse/);
assert.match(uiSrc, /loadState === 'read_failed'/);
assert.match(uiSrc, /initialSummary/);
assert.match(uiSrc, /publicSakSummaryLead/);
assert.doesNotMatch(uiSrc, /content_feedback/);

const pageSrc = readFileSync(
  join(process.cwd(), 'app/dashboard/sak/[id]/page.tsx'),
  'utf8',
);
assert.match(pageSrc, /readAiSummaryFromDb/);
assert.doesNotMatch(pageSrc, /content_feedback/);

const apiSrc = readFileSync(
  join(process.cwd(), 'app/api/sak/[id]/ai-summary/route.ts'),
  'utf8',
);
assert.doesNotMatch(apiSrc, /content_feedback/);

const stored: AiSummary = {
  version: 2,
  narrative: '  Saken gjelder stemmerett.  ',
  who_affected: '',
  how_affected: '',
  forslag: [],
  topic_cards: [],
  labels: [],
};
assert.equal(publicSakSummaryLead(stored), 'Saken gjelder stemmerett.');
assert.equal(
  publicSakSummaryLead({ version: 1, hva: 'Kort hva', hvem: 'Noen', kostnad: 'Ukjent' }),
  'Kort hva',
);
assert.equal(publicSakSummaryLead(null), null);
assert.equal(sakSummaryReadyFromStored(stored)?.version, 2);
assert.equal(
  sakSummaryReadyFromStored({
    version: 2,
    narrative: '   ',
    who_affected: '',
    how_affected: '',
    forslag: [],
    topic_cards: [],
    labels: [],
  }),
  null,
);

console.log('ai-summary/sak-summary-fetch.test.ts: ok', {
  readFailed: SAK_SUMMARY_READ_FAILED_MESSAGE.slice(0, 24),
  timeout: SAK_SUMMARY_TIMEOUT_MESSAGE,
});
