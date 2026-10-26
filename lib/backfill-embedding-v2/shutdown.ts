import type { BackfillSupabase } from './supabase-client';
import { collectSensitiveEnvValues, redactSensitiveLogText } from './secrets';
import { releaseWorkerClaims } from './worker';

export async function releaseAllWorkerClaims(
  supabase: BackfillSupabase,
  workerIds: string[],
): Promise<void> {
  for (const id of workerIds) {
    await releaseWorkerClaims(supabase, id);
  }
}

/** SIGINT/SIGTERM: release leases then exit(0). Used by scripts/backfill-embedding-v2.ts. */
export function installBackfillSignalHandlers(onStop: () => Promise<void>): void {
  let stopPromise: Promise<void> | null = null;
  let exitScheduled = false;
  const handle = () => {
    if (!stopPromise) {
      stopPromise = onStop();
    }
    if (exitScheduled) {
      return;
    }
    exitScheduled = true;
    void stopPromise
      .then(() => process.exit(0))
      .catch((err) => {
        const message = redactSensitiveLogText(
          err instanceof Error ? err.message : String(err),
          collectSensitiveEnvValues(),
        );
        console.error('[backfill-v2] Avslutning feilet:', message);
        process.exit(1);
      });
  };
  process.on('SIGINT', handle);
  process.on('SIGTERM', handle);
}
