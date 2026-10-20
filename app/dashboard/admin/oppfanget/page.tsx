import { permanentRedirect } from 'next/navigation';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Permanent redirect; query params (filtre) bevares. */
export default async function AdminOppfangetLegacyRedirect({ searchParams }: PageProps) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (typeof raw === 'string') {
      qs.set(key, raw);
    } else if (Array.isArray(raw)) {
      for (const part of raw) {
        qs.append(key, part);
      }
    }
  }
  const query = qs.toString();
  permanentRedirect(query ? `${routes.adminResearch}?${query}` : routes.adminResearch);
}
