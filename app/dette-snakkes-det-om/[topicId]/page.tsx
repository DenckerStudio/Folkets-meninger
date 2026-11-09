import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PublicResearchTopicPollPanel } from '@/components/research-topics/public-research-topic-poll-panel';
import { PublicResearchTopicSections } from '@/components/research-topics/public-research-topic-sections';
import { getPublicResearchTopicById } from '@/lib/research-topics/public-service';
import { buildPublicResearchTopicDetailMetadata } from '@/lib/research-topics/public-metadata';
import { isResearchTopicDedicatedIssueId } from '@/lib/sak/research-topic-dedicated-issue';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ topicId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { topicId } = await params;
  const topic = await getPublicResearchTopicById(topicId);
  if (!topic) return {};
  return buildPublicResearchTopicDetailMetadata(topic);
}

export default async function PublicResearchTopicPage({ params }: PageProps) {
  const { topicId } = await params;
  const topic = await getPublicResearchTopicById(topicId);
  if (!topic) notFound();

  const topicPath = routes.detteSnakkesDetOmTopic(topic.id);
  const sakHref = topic.sakId ? routes.sak(topic.sakId) : null;
  const dedicatedSak = topic.sakId ? isResearchTopicDedicatedIssueId(topic.sakId) : false;

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 pb-14 pt-6 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <Link
          href={routes.detteSnakkesDetOm}
          className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-sm font-medium text-[#00205b] hover:text-[#ba0c2f] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Dette snakkes det om
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#001433] sm:text-4xl">
          {topic.topicTitle}
        </h1>
        {topic.teaser ? (
          <p className="text-lg leading-relaxed text-[#001433]/70">{topic.teaser}</p>
        ) : null}
      </div>

      {(sakHref || topic.pollId) && (
        <section className="flex flex-col gap-3 rounded-2xl border border-[#00205b]/10 bg-[#00205b]/[0.02] p-5 sm:flex-row sm:flex-wrap sm:items-center">
          <p className="text-sm font-medium text-[#001433]">Relatert på Folkets Meninger</p>
          <div className="flex flex-wrap gap-3">
            {sakHref ? (
              <Link
                href={sakHref}
                className="inline-flex min-h-10 items-center rounded-full border border-[#00205b]/15 bg-white px-4 text-sm font-semibold text-[#00205b] hover:border-[#ba0c2f]/40 hover:text-[#ba0c2f]"
              >
                {dedicatedSak ? 'Åpne temasak' : 'Åpne sak'}
              </Link>
            ) : null}
            {topic.pollId ? (
              <Link
                href={routes.poll(topic.pollId)}
                className="inline-flex min-h-10 items-center rounded-full border border-[#00205b]/15 bg-white px-4 text-sm font-semibold text-[#00205b] hover:border-[#ba0c2f]/40 hover:text-[#ba0c2f]"
              >
                Åpne avstemning
              </Link>
            ) : null}
          </div>
        </section>
      )}

      <PublicResearchTopicSections sections={topic.sections} />

      {topic.pollId ? (
        <PublicResearchTopicPollPanel pollId={topic.pollId} topicPath={topicPath} />
      ) : null}
    </div>
  );
}
