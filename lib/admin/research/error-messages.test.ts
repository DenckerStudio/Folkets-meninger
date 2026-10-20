import assert from 'node:assert/strict';
import { formatResearchBriefError } from '@/lib/admin/research/error-messages';

assert.equal(formatResearchBriefError('tidsavbrudd'), 'Oppgaven ble avbrutt etter for lang ventetid i kø.');
assert.equal(
  formatResearchBriefError('arbeidsflyt_utilgjengelig'),
  'Arbeidsflyten er ikke tilgjengelig akkurat nå. Prøv igjen senere.',
);
assert.match(formatResearchBriefError('webhook_http_502') ?? '', /Kunne ikke nå arbeidsflyten/);
assert.equal(formatResearchBriefError(null), null);
assert.equal(
  formatResearchBriefError('Modellen returnerte ugyldig JSON.'),
  'Modellen returnerte ugyldig JSON.',
);

console.log('admin/research/error-messages.test.ts: ok');
