import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ResearchTopicBriefView } from '@/components/admin/research-topic-brief-view';
import { requireAdminPage } from '@/lib/admin/gate';
import { researchTopicBriefOutputSchema, researchTopicRowDisplayTitle } from '@/lib/admin/research/topic-brief-schema';
import { getResearchTopicById } from '@/lib/admin/research/topic-service';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminResearchTopicPage({ params }: PageProps) {
  await requireAdminPage(routes.adminResearch);
  const { id } = await params;
  const topic = await getResearchTopicById(id.trim());
  if (!topic) notFound();

  const pageTitle = researchTopicRowDisplayTitle({
    status: topic.status,
    rawTitle: topic.title,
    output: topic.output,
    redditSubreddit: topic.subreddit,
  });
  const parsedOutput = researchTopicBriefOutputSchema.safeParse(topic.output);
  const showRawSecondary =
    topic.status === 'done' &&
    topic.title &&
    parsedOutput.success &&
    Boolean(parsedOutput.data.topic_title?.trim());

  return (
    <div className="space-y-6" lang="nb-NO">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={routes.adminResearch} className="text-brand hover:underline">
            Research
          </Link>
          <span aria-hidden> / </span>
          <span className="line-clamp-1 text-foreground">Tema-brief</span>
        </p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">{pageTitle}</h1>
        {showRawSecondary ? (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{topic.title}</p>
        ) : null}
      </div>

      <ResearchTopicBriefView topic={topic} />

      <Link
        href={routes.adminResearch}
        className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline"
      >
        ← Tilbake til Research
      </Link>
    </div>
  );
}
