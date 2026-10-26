import type { BackfillSupabase } from './supabase-client';

/** WAL/slot lag throttle shared across all endpoint workers. */
export class SharedDbPressure {
  pauseUntilMs = 0;
  tier0Pending = false;

  isPaused(nowMs = Date.now()): boolean {
    return nowMs < this.pauseUntilMs;
  }

  async refresh(
    supabase: BackfillSupabase,
    options: { tier0Probe?: () => Promise<boolean> } = {},
  ): Promise<void> {
    const { data: pressure, error } = await supabase.rpc('n8n_backfill_db_pressure');
    if (!error && pressure?.pause_recommended) {
      this.pauseUntilMs = Date.now() + 60_000;
    }

    if (options.tier0Probe) {
      this.tier0Pending = await options.tier0Probe();
    }
  }

  resetForTests(): void {
    this.pauseUntilMs = 0;
    this.tier0Pending = false;
  }
}
