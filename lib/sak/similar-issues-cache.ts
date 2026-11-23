import type { SimilarSakerLoadResult } from '@/lib/sak/similar-issues-load';

type SimilarLoader = () => Promise<SimilarSakerLoadResult>;
type CacheWrapper = (fn: SimilarLoader) => SimilarLoader;

class SimilarSakerTransientError extends Error {}

/**
 * Cacher bare vellykkede oppslag. En feil kastes inne i den cachede funksjonen
 * (unstable_cache lagrer ikke kast) og blir til { status: 'error' } utenfor,
 * så en kortvarig RPC-feil ikke vises for alle besøkende i en time.
 */
export async function loadWithOkOnlyCache(
  load: SimilarLoader,
  cache: CacheWrapper,
): Promise<SimilarSakerLoadResult> {
  const cached = cache(async () => {
    const result = await load();
    if (result.status === 'error') {
      throw new SimilarSakerTransientError('Liknende saker kunne ikke lastes');
    }
    return result;
  });

  try {
    return await cached();
  } catch {
    return { status: 'error' };
  }
}
