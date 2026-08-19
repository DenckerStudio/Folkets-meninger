import { redirect } from 'next/navigation';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export default async function CompleteProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ? `?next=${encodeURIComponent(params.next)}` : '';
  redirect(`${routes.onboarding}${next}`);
}
