import type { RedditSignalSnapshotPoint } from '@/lib/reddit-signals/types';
import { computeRedditSignalEngagement } from '@/lib/reddit-signals/engagement';

const WIDTH = 56;
const HEIGHT = 22;

export function RedditSignalSparkline({ snapshots }: { snapshots: RedditSignalSnapshotPoint[] }) {
  if (snapshots.length < 2) {
    return (
      <span
        className="inline-flex h-[22px] w-14 items-center justify-center text-[10px] text-muted-foreground"
        title="For få målepunkter for vekstkurve"
      >
        —
      </span>
    );
  }

  const values = snapshots.map((s) =>
    computeRedditSignalEngagement(s.score, s.numComments, s.numCrossposts),
  );
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * WIDTH;
      const y = HEIGHT - ((v - min) / span) * (HEIGHT - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="text-brand"
      role="img"
      aria-label="Engasjementskurve fra målepunkter"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}