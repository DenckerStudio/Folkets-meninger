import { redirect } from 'next/navigation';
import { routes } from '@/lib/routes';

/** Post-login home: land on open saker so the first vote is one click away. */
export default function DashboardIndexPage() {
  redirect(routes.utforsk);
}
