import { computeRedditSignalEngagement } from '@/lib/reddit-signals/engagement';
import type { RedditSignalSnapshotPoint } from '@/lib/reddit-signals/types';

const MS_24H = 24 * 60 * 60 * 1000;

export function pickSnapshotBaseline24h(
  snapshots: RedditSignalSnapshotPoint[],
  nowMs = Date.now(),
): RedditSignalSnapshotPoint | null {
  if (snapshots.length === 0) return null;
  const cutoff = nowMs - MS_24H;
  const atOrBefore = snapshots.filter((s) => {
    const t = new Date(s.capturedAt).getTime();
    return Number.isFinite(t) && t <= cutoff;
  });
  if (atOrBefore.length === 0) return null;
  return atOrBefore.reduce((best, s) => {
    const t = new Date(s.capturedAt).getTime();
    const bestT = new Date(best.capturedAt).getTime();
    return t > bestT ? s : best;
  });
}

export function computeGrowth24hEngagement(
  current: { score: number; numComments: number; numCrossposts: number | null },
  snapshots: RedditSignalSnapshotPoint[],
  nowMs = Date.now(),
): number | null {
  const baseline = pickSnapshotBaseline24h(snapshots, nowMs);
  if (!baseline) return null;
  const nowEng = computeRedditSignalEngagement(
    current.score,
    current.numComments,
    current.numCrossposts,
  );
  const thenEng = computeRedditSignalEngagement(
    baseline.score,
    baseline.numComments,
    baseline.numCrossposts,
  );
  return nowEng - thenEng;
}