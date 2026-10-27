/** Resume autoplay after pause: offset start time and shorten the advance timeout. */
export function computeResume(
  progressPercent: number,
  durationMs: number,
  nowMs: number = Date.now()
): { startTimeMs: number; remainingMs: number } {
  const clamped = Math.min(100, Math.max(0, progressPercent));
  const elapsedMs = (clamped / 100) * durationMs;
  const remainingMs = Math.max(0, durationMs - elapsedMs);
  return {
    startTimeMs: nowMs - elapsedMs,
    remainingMs,
  };
}
