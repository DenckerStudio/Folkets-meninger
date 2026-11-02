import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  filterOppfangetRowsForResearchList,
  OPPFANGET_DISPLAY_TYPES_EXCLUDED_FROM_RESEARCH_LIST,
  shouldIncludeOppfangetRowInResearchList,
} from '@/lib/admin/oppfanget/excluded-from-research-list';
import { mapClusterToRow } from '@/lib/admin/oppfanget/service';

assert.deepEqual(OPPFANGET_DISPLAY_TYPES_EXCLUDED_FROM_RESEARCH_LIST, [
  'opprop',
  'aksjon',
  'boikott',
]);

assert.equal(shouldIncludeOppfangetRowInResearchList('melding'), true);
assert.equal(shouldIncludeOppfangetRowInResearchList('opprop'), false);

const signalCluster = {
  id: 'signal-1',
  action_name: 'Reddit-signal',
  action_type: 'opprop' as const,
  status: 'not_action' as const,
  sensitive_category: null,
  max_confidence: 0.4,
  best_scale: null,
  first_seen_at: '2026-11-01T10:00:00Z',
  last_seen_at: '2026-11-02T10:00:00Z',
  poll_id: null,
  metadata: null,
};

const actionCluster = {
  id: 'action-1',
  action_name: 'Opprop mot skolemat',
  action_type: 'opprop' as const,
  status: 'candidate' as const,
  sensitive_category: null,
  max_confidence: 0.9,
  best_scale: null,
  first_seen_at: '2026-11-01T10:00:00Z',
  last_seen_at: '2026-11-02T10:00:00Z',
  poll_id: null,
  metadata: null,
};

const signalRow = mapClusterToRow(signalCluster, [
  {
    id: 's1',
    cluster_id: 'signal-1',
    url_canonical: 'https://reddit.com/r/norge/example',
    publisher: 'reddit.com',
    signal_only: true,
    title: 'Diskusjon',
    source_type: 'reddit',
  },
], null);

const actionRow = mapClusterToRow(actionCluster, [
  {
    id: 's2',
    cluster_id: 'action-1',
    url_canonical: 'https://www.opprop.net/example',
    publisher: 'opprop.net',
    signal_only: false,
    title: 'Opprop',
    source_type: 'petition',
  },
], null);

assert.equal(signalRow.displayType, 'melding');
assert.equal(actionRow.displayType, 'opprop');

const filtered = filterOppfangetRowsForResearchList([signalRow, actionRow]);
assert.deepEqual(
  filtered.map((row) => row.id),
  ['signal-1'],
);

const serviceSrc = readFileSync(
  join(process.cwd(), 'lib/admin/oppfanget/service.ts'),
  'utf-8',
);
assert.match(serviceSrc, /filterOppfangetRowsForResearchList/);
assert.match(serviceSrc, /OPPFANGET_CLUSTER_MAX_BATCHES/);
assert.match(serviceSrc, /\.range\(rangeFrom, rangeTo\)/);
assert.doesNotMatch(serviceSrc, /OPPFANGET_ACTION_TYPES_EXCLUDED/);

console.log('excluded-from-research-list.test.ts: ok');
