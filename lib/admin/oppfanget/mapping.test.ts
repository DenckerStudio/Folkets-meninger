import assert from 'node:assert/strict';
import {
  inferIsSignalRow,
  mapActionTypeToDisplayType,
  mapClusterAndPollToDisplayStatus,
} from '@/lib/admin/oppfanget/mapping';

assert.equal(mapActionTypeToDisplayType('boykott'), 'boikott');
assert.equal(mapActionTypeToDisplayType('opprop'), 'opprop');
assert.equal(mapActionTypeToDisplayType('demonstrasjon'), 'aksjon');
assert.equal(
  mapActionTypeToDisplayType('kampanje', { isSignal: true }),
  'melding',
);

assert.equal(
  mapClusterAndPollToDisplayStatus('below_threshold', null),
  'under_terskel',
);
assert.equal(mapClusterAndPollToDisplayStatus('drafted', 'draft'), 'utkast_laget');
assert.equal(mapClusterAndPollToDisplayStatus('drafted', 'open'), 'publisert');
assert.equal(mapClusterAndPollToDisplayStatus('blocked', null), 'avvist');

assert.equal(
  inferIsSignalRow({
    clusterStatus: 'candidate',
    metadata: { record_kind: 'signal' },
    sourcesSignalOnly: false,
    hasNonSignalSource: true,
  }),
  true,
);

console.log('admin/oppfanget/mapping.test.ts: ok');
