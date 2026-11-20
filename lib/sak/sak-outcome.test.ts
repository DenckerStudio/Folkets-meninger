import assert from 'node:assert/strict';
import { deriveSakOutcome, sakStatusOrOutcomeLabel } from './sak-outcome';

// Stortingets kortvedtak for sak 200211 (representantforslag, ikke vedtatt).
const kortvedtak200211 =
  'Stortinget har behandlet et representantforslag fra Miljøpartiet De Grønne om å dele ut statens inntekter fra klimaavgifter til befolkningen.\r\n\r\nForslaget ble ikke vedtatt. \r\n\r\n';

const rejected = deriveSakOutcome({
  status: 'closed',
  kortvedtak: kortvedtak200211,
  vedtakstekst: 'Vedtak i samsvar med innstillingen',
});
assert.equal(rejected.kind, 'rejected');
assert.equal(rejected.label, 'Ikke vedtatt');
assert.equal(rejected.sentence, 'Forslaget ble ikke vedtatt.');

const adopted = deriveSakOutcome({
  status: 'closed',
  kortvedtak: 'Stortinget har vedtatt endringer i straffeloven.',
});
assert.equal(adopted.kind, 'adopted');
assert.equal(adopted.label, 'Vedtatt');
assert.equal(adopted.sentence, 'Stortinget har vedtatt endringer i straffeloven.');

assert.equal(
  deriveSakOutcome({ status: 'closed', kortvedtak: 'Forslaget ble vedtatt med 60 mot 40 stemmer.' }).label,
  'Vedtatt',
);
assert.equal(
  deriveSakOutcome({ status: 'closed', kortvedtak: 'Stortinget vedtok ikke forslaget.' }).label,
  'Ikke vedtatt',
);
assert.equal(
  deriveSakOutcome({ status: 'closed', kortvedtak: 'Forslaget ble forkastet.' }).label,
  'Ikke vedtatt',
);
assert.equal(
  deriveSakOutcome({ status: 'closed', vedtakstekst: 'Stortinget har vedtatt lov om endringer i x.' }).label,
  'Vedtatt',
  'vedtakstekst brukes når kortvedtak mangler',
);

// Ekte kortvedtak fra Stortingets eksport (sak 105779, 105846 og 105848).
assert.equal(
  deriveSakOutcome({
    status: 'closed',
    kortvedtak:
      'Stortinget har behandlet et representantforslag fra Høyre om å gjøre det enklere for unge å komme i jobb.\r\n\r\nStortinget vedtok å be regjeringen utrede handlingsrommet for å gi noen flere unntak.',
  }).label,
  'Vedtatt',
);
assert.equal(
  deriveSakOutcome({
    status: 'closed',
    kortvedtak: 'Stortinget har vedtatt endringer i straffelovens bestemmelser om inndragning.\r\n\r\nStortinget vedtok også å be regjeringen lage en plan.',
  }).label,
  'Vedtatt',
);
assert.equal(
  deriveSakOutcome({
    status: 'closed',
    kortvedtak: 'Stortinget har enstemmig samtykket til godkjenning av EØS-komiteens beslutning nr. 221/2024.',
  }).label,
  'Vedtatt',
);

const mixed = deriveSakOutcome({
  status: 'closed',
  kortvedtak: 'Forslag 1 ble vedtatt. Forslag 2 ble ikke vedtatt.',
});
assert.equal(mixed.kind, 'unknown', 'blandet utfall gjettes ikke');
assert.equal(mixed.label, null);

assert.equal(deriveSakOutcome({ status: 'closed', vedtakstekst: 'Vedtak i samsvar med innstillingen' }).kind, 'unknown');
assert.equal(deriveSakOutcome({ status: 'closed' }).kind, 'unknown');
assert.equal(deriveSakOutcome({ status: 'closed', kortvedtak: '   ' }).label, null);

const pending = deriveSakOutcome({ status: 'pending', kortvedtak: 'Forslaget ble ikke vedtatt.' });
assert.equal(pending.kind, 'pending');
assert.equal(pending.label, 'Under behandling');

assert.equal(sakStatusOrOutcomeLabel({ status: 'closed', kortvedtak: kortvedtak200211 }), 'Ikke vedtatt');
assert.equal(sakStatusOrOutcomeLabel({ status: 'closed' }), 'Ferdigbehandlet');
assert.equal(sakStatusOrOutcomeLabel({ status: 'pending' }), 'Under behandling');

console.log('lib/sak/sak-outcome.test.ts: ok');
