import { redirect } from 'next/navigation';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export default async function NewForumThreadPage({
  searchParams,
}: {
  searchParams: Promise<{ sak?: string }>;
}) {
  const params = await searchParams;
  const sakId = params.sak?.trim();
  redirect(sakId ? `${routes.forum}?sak=${sakId}#del-din-mening` : `${routes.forum}#del-din-mening`);
}
