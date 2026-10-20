export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { assertProductionCmsConfig } = await import('@/lib/serverOrigins');
  assertProductionCmsConfig();
  const { ensurePayloadReady } = await import('@/lib/warmPayload');
  await ensurePayloadReady();
}
