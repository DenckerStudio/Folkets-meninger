/** Prod/network live probes are opt-in on CI (GitHub sets CI=true). */
export function exitIfCiSkipsProdLive(label: string): void {
  if (process.env.CI === 'true' && process.env.FM_RUN_PROD_LIVE_TESTS !== '1') {
    console.log(
      `${label}: skipped in CI (prod/cache/network dependent; set FM_RUN_PROD_LIVE_TESTS=1 to run)`,
    );
    process.exit(0);
  }
}
