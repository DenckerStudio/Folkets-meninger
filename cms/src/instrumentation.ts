export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { assertProductionCmsConfig } = await import('@/lib/serverOrigins');
    assertProductionCmsConfig();
  } catch (error) {
    console.error(
      '[fm-cms] Production config validation failed:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
  const { ensurePayloadReady } = await import('@/lib/warmPayload');
  await ensurePayloadReady();
}
