export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { ensurePayloadReady } = await import('@/lib/warmPayload');
  await ensurePayloadReady();
}
