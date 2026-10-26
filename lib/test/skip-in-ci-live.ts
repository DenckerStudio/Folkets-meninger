/** Live probes (network / hosted Supabase) are opt-in via FM_RUN_LIVE_PROBES in `.env.test`. */
export function liveProbesEnabled(): boolean {
  return (
    process.env.FM_RUN_LIVE_PROBES === '1' || process.env.FM_RUN_PROD_LIVE_TESTS === '1'
  );
}

export function exitIfCiSkipsProdLive(label: string): void {
  if (!liveProbesEnabled()) {
    console.log(
      `${label}: skipped (live probes off; set FM_RUN_LIVE_PROBES=1 in env to run)`,
    );
    process.exit(0);
  }
}
