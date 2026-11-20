import assert from 'node:assert/strict';
import { isSummaryLeadAlreadyShown } from './lead-dedupe';

const narrative =
  'Saken gjelder et representantforslag om å dele ut statens inntekter fra klimaavgifter til befolkningen. Forslaget ble ikke vedtatt.';

assert.equal(isSummaryLeadAlreadyShown(narrative, narrative), true, 'lik tekst');
assert.equal(isSummaryLeadAlreadyShown(`  ${narrative.toUpperCase()}\n`, narrative), true, 'ulik skriftstørrelse og blanke');
assert.equal(
  isSummaryLeadAlreadyShown('Saken gjelder et representantforslag', narrative),
  true,
  'ledeteksten er en del av teksten over',
);
assert.equal(
  isSummaryLeadAlreadyShown(`${narrative} Ny setning etter oppdatering.`, narrative),
  false,
  'lengre, oppdatert tekst vises',
);
assert.equal(isSummaryLeadAlreadyShown('Helt annen tekst.', narrative), false);
assert.equal(isSummaryLeadAlreadyShown(narrative, null), false, 'ingenting vist over');
assert.equal(isSummaryLeadAlreadyShown(null, narrative), false);
assert.equal(isSummaryLeadAlreadyShown('', narrative), false);

console.log('lib/ai-summary/lead-dedupe.test.ts: ok');
