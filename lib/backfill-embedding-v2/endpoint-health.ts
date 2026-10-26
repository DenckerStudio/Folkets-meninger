export const DEFAULT_MAX_BACKOFF_MS = 5 * 60 * 1000;

export class EndpointHealth {
  private backoffUntilMs = 0;
  private failureStreak = 0;
  preflightOk = false;
  needsPreflight = true;

  constructor(
    private readonly baseDelayMs = 2000,
    private readonly maxBackoffMs = DEFAULT_MAX_BACKOFF_MS,
  ) {}

  isBackingOff(nowMs = Date.now()): boolean {
    return nowMs < this.backoffUntilMs;
  }

  backoffRemainingMs(nowMs = Date.now()): number {
    return Math.max(0, this.backoffUntilMs - nowMs);
  }

  recordSuccess(): void {
    this.failureStreak = 0;
    this.backoffUntilMs = 0;
  }

  recordFailure(nowMs = Date.now()): void {
    this.failureStreak += 1;
    const exp = Math.min(
      this.maxBackoffMs,
      this.baseDelayMs * 2 ** Math.min(this.failureStreak - 1, 8),
    );
    this.backoffUntilMs = nowMs + exp;
    this.preflightOk = false;
    this.needsPreflight = true;
  }

  markPreflightPassed(): void {
    this.preflightOk = true;
    this.needsPreflight = false;
    this.recordSuccess();
  }

  resetForTests(): void {
    this.backoffUntilMs = 0;
    this.failureStreak = 0;
    this.preflightOk = false;
    this.needsPreflight = true;
  }
}
