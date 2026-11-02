import assert from 'node:assert/strict';
import { formatResearchBriefError } from '@/lib/admin/research/error-messages';

assert.equal(formatResearchBriefError('modell_feil'), 'Modellen kunne ikke fullføre oppgaven.');
assert.equal(formatResearchBriefError('tidsavbrudd'), 'Oppgaven ble avbrutt etter for lang ventetid i kø.');
assert.equal(
  formatResearchBriefError('arbeidsflyt_utilgjengelig'),
  'Arbeidsflyten er ikke tilgjengelig akkurat nå. Prøv igjen senere.',
);
assert.match(formatResearchBriefError('webhook_http_404') ?? '', /ikke aktiv i n8n/);
assert.match(formatResearchBriefError('webhook_http_503') ?? '', /feilkode 503/);
assert.equal(formatResearchBriefError('webhook_http_401'), 'Webhook-token ble avvist.');
assert.equal(formatResearchBriefError(null), null);
assert.equal(
  formatResearchBriefError('Modellen returnerte ugyldig JSON.'),
  'Modellen returnerte ugyldig JSON.',
);

console.log('admin/research/error-messages.test.ts: ok');
