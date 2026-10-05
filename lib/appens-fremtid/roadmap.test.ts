import assert from 'node:assert/strict';
import { nextRoadmapSortOrder, sortRoadmapItems } from '@/lib/appens-fremtid/roadmap';
import type { RoadmapItem } from '@/lib/appens-fremtid/constants';

function item(partial: Partial<RoadmapItem> & Pick<RoadmapItem, 'id' | 'sortOrder'>): RoadmapItem {
  return {
    title: partial.title ?? partial.id,
    body: partial.body ?? 'Beskrivelse som er lang nok.',
    status: partial.status ?? 'planned',
    createdAt: partial.createdAt ?? '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

const later = item({ id: 'b', sortOrder: 2, createdAt: '2026-02-01T00:00:00.000Z' });
const earlier = item({ id: 'a', sortOrder: 0, createdAt: '2026-03-01T00:00:00.000Z' });
const sameOrderOlder = item({ id: 'c', sortOrder: 2, createdAt: '2026-01-15T00:00:00.000Z' });

assert.deepEqual(
  sortRoadmapItems([later, sameOrderOlder, earlier]).map((row) => row.id),
  ['a', 'c', 'b'],
);
assert.equal(nextRoadmapSortOrder([]), 0);
assert.equal(nextRoadmapSortOrder([earlier, later]), 3);

console.log('appens-fremtid/roadmap.test.ts: ok');
