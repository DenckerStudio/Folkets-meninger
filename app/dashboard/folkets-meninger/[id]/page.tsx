import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OpinionDetailClient } from './opinion-detail-client';
import { getCitizenOpinion } from '@/lib/opinions/service';
import { isOpinionStance } from '@/lib/opinions/validate';
import type { OpinionStance } from '@/lib/opinions/types';
import { getServerSupabase } from '@/lib/supabase-server';
import { buildPageMetadata, truncateDescription } from '@/lib/seo/metadata';
import {
  findHearingLinkForSak,
  getOpinionInnspill,
  userEndorsedOpinionInnspillIds,
} from '@/lib/innspill/service';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ standpunkt?: string | string[] }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const opinion = await getCitizenOpinion(id, null).catch(() => null);

  if (!opinion) {
    return buildPageMetadata({
      title: 'Mening ikke funnet',
      description: 'Fant ikke innlegget.',
      canonicalPath: `/dashboard/folkets-meninger/${id}`,
      robots: { index: false, follow: false },
    });
  }

  const title = (opinion.title || 'Mening').trim();
  const body = opinion.body ?? '';
  const description = body
    ? truncateDescription(body)
    : `Les meningen «${truncateDescription(title, 90)}» på Folkets Meninger.`;

  return buildPageMetadata({
    title: truncateDescription(title, 70),
    description,
    canonicalPath: `/dashboard/folkets-meninger/${id}`,
    openGraphType: 'article',
  });
}

export default async function OpinionDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolved = searchParams ? await searchParams : undefined;
  const stanceParam = resolved?.standpunkt;
  const stanceValue = Array.isArray(stanceParam) ? stanceParam[0] : stanceParam;
  const initialReplyStance: OpinionStance | null = isOpinionStance(stanceValue)
    ? stanceValue
    : null;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const opinion = await getCitizenOpinion(id, user?.id ?? null);
  if (!opinion) notFound();

  const [innspill, hearing, endorsed] = await Promise.all([
    getOpinionInnspill(id),
    opinion.stortingetIssueId ? findHearingLinkForSak(opinion.stortingetIssueId) : Promise.resolve(null),
    userEndorsedOpinionInnspillIds(user?.id ?? null, [id]),
  ]);

  return (
    <OpinionDetailClient
      opinion={opinion}
      isAuthor={Boolean(user && user.id === opinion.authorUserId)}
      initialReplyStance={initialReplyStance}
      innspill={{
        status: innspill?.status ?? null,
        supportCount: innspill?.supportCount ?? 0,
        supportThreshold: innspill?.supportThreshold ?? 0,
        packagedAt: innspill?.packagedAt ?? null,
        hearingTitle: hearing?.title ?? null,
        hearingDeadlineLabel: hearing?.deadlineLabel ?? null,
        endorsedByViewer: endorsed.has(id),
      }}
    />
  );
}
