import type { SporsmalType } from '@/lib/stortinget';
import { routes } from '@/lib/routes';

export function buildSporsmalAlleTemaHref(
  type: SporsmalType,
  sesjonId: string,
  searchParams: URLSearchParams,
): string {
  const params = new URLSearchParams(searchParams.toString());
  params.set('type', type);
  params.set('sesjonId', sesjonId);
  params.delete('tema');
  params.delete('page');
  const qs = params.toString();
  return qs ? `${routes.sporsmal}?${qs}` : routes.sporsmal;
}