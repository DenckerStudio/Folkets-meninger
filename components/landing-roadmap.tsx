'use client';

import { EmptyLineState } from '@/components/motion/empty-line';
import { Timeline, type TimelineItem, type TimelineStatus } from '@/components/ui/modern-timeline';
import { roadmapStatusLabel, type RoadmapItem, type RoadmapStatus } from '@/lib/appens-fremtid/constants';
import { sortRoadmapItems } from '@/lib/appens-fremtid/roadmap';

function toTimelineStatus(status: RoadmapStatus): TimelineStatus {
  switch (status) {
    case 'done':
      return 'completed';
    case 'in_progress':
      return 'current';
    case 'planned':
      return 'upcoming';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function LandingRoadmap({
  items,
  selectedId,
  onSelect,
}: {
  items: RoadmapItem[];
  selectedId?: string | null;
  onSelect?: (item: RoadmapItem) => void;
}) {
  const sorted = sortRoadmapItems(items);

  if (sorted.length === 0) {
    return (
      <div id="veien-videre" className="scroll-mt-28">
        <EmptyLineState className="py-12 text-muted-foreground">
          Veikartet er tomt ennå.
        </EmptyLineState>
      </div>
    );
  }

  const timelineItems: TimelineItem[] = sorted.map((item) => ({
    id: item.id,
    category: roadmapStatusLabel(item.status),
    date: '',
    title: item.title,
    description: item.body,
    status: toTimelineStatus(item.status),
  }));

  return (
    <div id="veien-videre" className="scroll-mt-28">
      <Timeline
        title="Veien videre"
        subtitle="Hva som er live, og hva som kommer."
        items={timelineItems}
        selectedId={selectedId ?? undefined}
        onItemClick={
          onSelect
            ? (item) => {
                const found = sorted.find((row) => row.id === item.id);
                if (found) onSelect(found);
              }
            : undefined
        }
      />
    </div>
  );
}
