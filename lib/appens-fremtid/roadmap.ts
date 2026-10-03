import type { RoadmapItem } from '@/lib/appens-fremtid/constants';

export function sortRoadmapItems(items: RoadmapItem[]): RoadmapItem[] {
  return items.slice().sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function nextRoadmapSortOrder(items: RoadmapItem[]): number {
  return items.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
}
