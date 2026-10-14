import {
  getSakPickerOption,
  listCitizenOpinions,
  listCitizenOpinionsByIssue,
  listSakPickerOptions,
} from '@/lib/opinions/service';
import { listSystemReelFeedItems } from '@/lib/polls/service';
import { FolketsMeningerClient } from '@/components/opinions/folkets-meninger-client';
import type { ReelPromo } from '@/components/opinions/reel-promo-card';
import { parseOpinionCreateStanceParam } from '@/lib/stances/model';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata = buildPageMetadata({
  title: 'Folkets meninger',
  description:
    'Les og del meninger om Stortingssaker. Ett innlegg per bruker, med for- og imot-punkter.',
  canonicalPath: '/dashboard/folkets-meninger',
});

type PageProps = {
  searchParams?: Promise<{
    sak?: string | string[];
    compose?: string | string[];
    standpunkt?: string | string[];
  }>;
};

export default async function FolketsMeningerPage({ searchParams }: PageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  const sakParam = resolved?.sak;
  const issueId = typeof sakParam === 'string' && sakParam.trim() ? sakParam.trim() : null;
  const composeParam = resolved?.compose;
  const initialCompose = composeParam === '1' || composeParam === 'true';
  const stanceParam = resolved?.standpunkt;
  const initialStance = parseOpinionCreateStanceParam(
    typeof stanceParam === 'string' ? stanceParam : undefined,
  );

  const [opinions, sakOptions, reels] = await Promise.all([
    issueId ? listCitizenOpinionsByIssue(issueId, 40) : listCitizenOpinions(40),
    listSakPickerOptions(300),
    issueId ? Promise.resolve([]) : listSystemReelFeedItems(null, 8),
  ]);

  const reelPromos: ReelPromo[] = reels.map((item) => ({
    id: item.poll.id,
    title: item.poll.title,
    neutralSummary: item.poll.neutralSummary,
  }));

  const reelPollIds = reels.map((item) => item.poll.id);

  let options = sakOptions;
  if (issueId && !options.some((option) => option.id === issueId)) {
    const scoped = await getSakPickerOption(issueId);
    if (scoped) options = [scoped, ...options];
  }

  return (
    <FolketsMeningerClient
      opinions={opinions}
      sakOptions={options}
      issueId={issueId}
      initialCompose={initialCompose}
      initialStance={initialStance}
      reelPromos={reelPromos}
      reelPollIds={reelPollIds}
    />
  );
}
