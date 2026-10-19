/** After deploy / cold start, refresh blog ISR so a build-time «utilgjengelig» shell does not linger. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/blogg', 'layout');
  } catch (error) {
    console.error('[instrumentation] klarte ikke å revalidere /blogg ved oppstart', error);
  }
}
