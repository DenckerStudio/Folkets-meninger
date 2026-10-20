import { permanentRedirect } from 'next/navigation';
import { routes } from '@/lib/routes';

/** Legacy route — content lives on the landing page. */
export default function HvaErAnnerledesRedirectPage() {
  permanentRedirect(routes.hvaErAnnerledes);
}
