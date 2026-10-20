import { routes } from '@/lib/routes';

export type BloggSecondaryAction = {
  href: string;
  label: string;
};

/** Blog index + paginated index should not link back to /blogg (dead loop when CMS is down). */
export function getBloggSecondaryAction(pathname: string | null): BloggSecondaryAction {
  if (!pathname) {
    return { href: routes.blogg, label: 'Til bloggforsiden' };
  }
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/blogg' || /^\/blogg\/side\/\d+$/.test(normalized)) {
    return { href: routes.home, label: 'Til forsiden' };
  }
  return { href: routes.blogg, label: 'Til bloggforsiden' };
}
