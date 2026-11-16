import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin/gate';
import { getSakPageBundle } from '@/lib/stortinget';
import { SakPageActions } from '@/components/sak/sak-page-actions';
import { StortingetPollAdminSection } from '@/components/sak/stortinget-poll-admin-section';
import { publicSakSummaryLead } from '@/lib/ai-summary/sak-summary-fetch';
import { readAiSummaryFromDb } from '@/lib/ai-summary/service';
import { listPollsForStortingetIssueAdmin } from '@/lib/polls/stortinget-poll-admin-data';
import { resolveStortingetPollAdminUiState } from '@/lib/polls/stortinget-poll-admin-guard';
import { getStortingetSakUrl } from '@/lib/stortinget-horinger';
import { isResearchTopicDedicatedIssueId } from '@/lib/sak/research-topic-dedicated-issue';
import { routes } from '@/lib/routes';
import { truncateDescription } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminSakPollPage({ params }: PageProps) {
  await requireAdminPage(routes.admin);
  const { id } = await params;
  const bundle = await getSakPageBundle(id.trim());
  if (!bundle) notFound();

  const { sak, detail } = bundle;
  const isDedicatedResearchSak = isResearchTopicDedicatedIssueId(sak.id);
  const summaryRead = isDedicatedResearchSak
    ? { status: 'ok' as const, summary: null }
    : await readAiSummaryFromDb(sak.id);
  const storedSummary = summaryRead.status === 'ok' ? summaryRead.summary : null;

  const officialTitle = (detail?.korttittel || detail?.tittel || sak.title).trim();
  const officialDescription = (detail?.tittel || sak.summary || '').trim();
  const descriptionToShow =
    officialDescription && officialDescription !== officialTitle ? officialDescription : '';

  const adminState = resolveStortingetPollAdminUiState(await listPollsForStortingetIssueAdmin(sak.id));
  const pollDefaultNeutralSummary =
    (publicSakSummaryLead(storedSummary) ?? descriptionToShow.trim()) || '';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6" lang="nb-NO">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href={routes.admin} className="text-brand hover:underline">
            Admin
          </Link>
          <span aria-hidden> / </span>
          <Link href={routes.sak(sak.id)} className="text-brand hover:underline">
            Sak {sak.id}
          </Link>
          <span aria-hidden> / </span>
          <span className="text-foreground">Avstemning</span>
        </p>
        <h1 className="text-2xl font-bold text-foreground">Avstemning for sak</h1>
        <p className="line-clamp-3 text-sm text-muted-foreground">{officialTitle}</p>
      </div>

      <StortingetPollAdminSection
        sakId={sak.id}
        sakTitle={officialTitle}
        defaultNeutralSummary={pollDefaultNeutralSummary}
        stortingetPageUrl={isDedicatedResearchSak ? null : getStortingetSakUrl(sak.id)}
        adminState={adminState}
      />

      <SakPageActions
        sakId={sak.id}
        title={officialTitle}
        description={
          descriptionToShow
            ? truncateDescription(descriptionToShow)
            : `Administrer avstemning for «${truncateDescription(officialTitle, 90)}».`
        }
      />

      <Link
        href={routes.sak(sak.id)}
        className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline"
      >
        ← Til sakssiden
      </Link>
    </div>
  );
}