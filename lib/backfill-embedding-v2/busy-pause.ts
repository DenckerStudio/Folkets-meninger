export type LatencySample = {
  atMs: number;
  latencyMs: number;
};

export class LatencyBackoff {
  private readonly thresholdMs: number;
  private readonly resumeFactor: number;
  private samples: LatencySample[] = [];
  private paused = false;

  constructor(thresholdMs: number, resumeFactor = 0.85) {
    this.thresholdMs = Math.max(100, thresholdMs);
    this.resumeFactor = resumeFactor;
  }

  record(latencyMs: number, nowMs = Date.now()): void {
    this.samples.push({ atMs: nowMs, latencyMs });
    if (this.samples.length > 20) {
      this.samples.shift();
    }
    const recent = this.recentMean(nowMs);
    if (recent > this.thresholdMs) {
      this.paused = true;
    } else if (this.paused && recent < this.thresholdMs * this.resumeFactor) {
      this.paused = false;
    }
  }

  recentMean(nowMs = Date.now(), windowMs = 120_000): number {
    const cutoff = nowMs - windowMs;
    const relevant = this.samples.filter((s) => s.atMs >= cutoff);
    if (relevant.length === 0) return 0;
    return relevant.reduce((sum, s) => sum + s.latencyMs, 0) / relevant.length;
  }

  isPaused(): boolean {
    return this.paused;
  }

  resetForTests(): void {
    this.samples = [];
    this.paused = false;
  }
}

export type LaneThrottleInput = {
  tier0Pending: boolean;
  lane: 'fast' | 'background';
  scheduleMode: 'full' | 'throttle';
  busyPauseEnabled: boolean;
  latencyPaused: boolean;
  maxBatchesPerMin: number;
  fastLaneMinBatchesPerMin: number;
};

/** Fast lane wins: background yields when tier 0 exists; fast lane keeps a minimum rate. */
export function effectiveMaxBatchesPerMinute(input: LaneThrottleInput): number {
  if (input.lane === 'background' && input.tier0Pending) {
    return 0;
  }

  let cap = input.maxBatchesPerMin;
  if (input.scheduleMode === 'throttle') {
    cap = Math.min(cap, input.maxBatchesPerMin);
  }

  if (input.lane === 'fast' && input.tier0Pending) {
    cap = Math.max(cap, input.fastLaneMinBatchesPerMin);
  }

  if (input.busyPauseEnabled && input.latencyPaused && input.lane !== 'fast') {
    return 0;
  }

  if (input.busyPauseEnabled && input.latencyPaused && input.lane === 'fast') {
    return Math.max(input.fastLaneMinBatchesPerMin, 1);
  }

  return cap;
}

export function shouldSleepForBatchRate(
  batchesThisMinute: number,
  maxBatchesPerMin: number,
): boolean {
  if (maxBatchesPerMin <= 0) return true;
  return batchesThisMinute >= maxBatchesPerMin;
}
