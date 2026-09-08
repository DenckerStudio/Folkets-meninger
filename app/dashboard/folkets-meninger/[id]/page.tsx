import { notFound } from 'next/navigation';
import { OpinionDetailClient } from './opinion-detail-client';
import { getCitizenOpinion } from '@/lib/opinions/service';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OpinionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const opinion = await getCitizenOpinion(id, user?.id ?? null);
  if (!opinion) notFound();

  return <OpinionDetailClient opinion={opinion} isAuthor={Boolean(user && user.id === opinion.authorUserId)} />;
}
