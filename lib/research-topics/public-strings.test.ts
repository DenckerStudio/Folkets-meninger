import assert from 'node:assert/strict';
import { validateResearchTopicPublicString } from '@/lib/research-topics/public-strings';
import { buildResearchTopicPublicTitle } from '@/lib/research-topics/public-content';

assert.equal(validateResearchTopicPublicString('Innlegg om reddit'), 'Teksten kan ikke nevne Reddit');
assert.equal(validateResearchTopicPublicString('Rent innhold'), null);

const titleFromOutput = buildResearchTopicPublicTitle({
  topic_title: 'Kommunal formuesskatt',
  current_rules: { items: [], note: 'ingen funnet' },
  party_proposals: { items: [], note: 'ingen funnet' },
  media_coverage: { items: [], note: 'ingen funnet' },
  polls: { items: [], note: 'ingen funnet' },
  sources: { items: [], note: 'ingen funnet' },
});
assert.equal(titleFromOutput, 'Kommunal formuesskatt');

assert.equal(
  buildResearchTopicPublicTitle({
    ...{
      topic_title: 'Reddit-debatten',
      current_rules: { items: [], note: 'ingen funnet' },
      party_proposals: { items: [], note: 'ingen funnet' },
      media_coverage: { items: [], note: 'ingen funnet' },
      polls: { items: [], note: 'ingen funnet' },
      sources: { items: [], note: 'ingen funnet' },
    },
  }),
  null,
);

console.log('lib/research-topics/public-strings.test.ts: ok');
