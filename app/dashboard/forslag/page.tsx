import { redirect } from 'next/navigation';
import { routes } from '@/lib/routes';

export default function ForslagRedirectPage() {
  redirect(routes.forslag);
}
