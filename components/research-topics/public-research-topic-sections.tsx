import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import {
  RESEARCH_TOPIC_BRIEF_GRADE_LEGEND,
  formatResearchTopicBriefGeneratedAt,
  type ResearchTopicBriefSource,
} from '@/lib/admin/research/topic-brief-schema';
import type { PublicResearchTopicBriefSections } from '@/lib/research-topics/public-content';

function SectionBlock({
  heading,
  empty,
  children,
}: {
  heading: string;
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-[#001433]">{heading}</h2>
      {empty ? <p className="text-sm text-[#001433]/60">Ingen funnet</p> : children}
    </section>
  );
}

function GradeBadge({ grade }: { grade: ResearchTopicBriefSource['grade'] }) {
  return (
    <span
      title={`Kildekvalitet ${grade}. ${RESEARCH_TOPIC_BRIEF_GRADE_LEGEND}`}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-[#00205b]/15 bg-[#00205b]/[0.04] text-xs font-semibold tabular-nums text-[#00205b]"
    >
      {grade}
    </span>
  );
}

function SourceList({ sources }: { sources: ResearchTopicBriefSource[] }) {
  if (sources.length === 0) {
    return <p className="text-sm text-[#001433]/60">Ingen funnet</p>;
  }
  return (
    <ul className="space-y-2">
      {sources.map((source) => (
        <li
          key={source.id}
          className="flex flex-wrap items-start gap-2 rounded-xl border border-[#00205b]/10 bg-white p-3 text-sm"
        >
          <GradeBadge grade={source.grade} />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-medium text-[#001433]">{source.title}</p>
            {source.publisher ? (
              <p className="text-xs text-[#001433]/55">{source.publisher}</p>
            ) : null}
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs font-medium text-[#00205b] hover:text-[#ba0c2f] hover:underline"
            >
              <span className="truncate">{source.url}</span>
              <ExternalLink className="size-3 shrink-0" aria-hidden />
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}

type PublicResearchTopicSectionsProps = {
  sections: PublicResearchTopicBriefSections;
};

export function PublicResearchTopicSections({ sections }: PublicResearchTopicSectionsProps) {
  return (
    <div className="space-y-10">
      <SectionBlock heading="Dagens regler" empty={sections.currentRules.length === 0}>
        {sections.currentRules.length > 0 ? (
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#001433]/80">
            {sections.currentRules.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        ) : null}
      </SectionBlock>

      <SectionBlock heading="Partienes forslag" empty={sections.partyProposals.length === 0}>
        {sections.partyProposals.length > 0 ? (
          <ul className="space-y-4">
            {sections.partyProposals.map((row, idx) => (
              <li key={idx} className="text-sm">
                {row.party ? (
                  <p className="font-semibold text-[#001433]">{row.party}</p>
                ) : null}
                {row.proposal ? (
                  <p className="mt-1 text-[#001433]/75">{row.proposal}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </SectionBlock>

      <SectionBlock heading="Mediedekning" empty={sections.mediaCoverage.length === 0}>
        {sections.mediaCoverage.length > 0 ? (
          <ul className="space-y-4">
            {sections.mediaCoverage.map((row, idx) => (
              <li key={idx} className="text-sm">
                {row.headline ? (
                  <p className="font-semibold text-[#001433]">{row.headline}</p>
                ) : null}
                {row.summary ? <p className="mt-1 text-[#001433]/75">{row.summary}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </SectionBlock>

      <SectionBlock heading="Meningsmålinger" empty={sections.polls.length === 0}>
        {sections.polls.length > 0 ? (
          <ul className="space-y-4">
            {sections.polls.map((row, idx) => (
              <li key={idx} className="text-sm">
                {row.question ? <p className="font-medium text-[#001433]">{row.question}</p> : null}
                {row.result ? (
                  <p className="mt-1 tabular-nums text-[#001433]/70">{row.result}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </SectionBlock>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#001433]">Kilder</h2>
        <SourceList sources={sections.sources} />
        <p className="text-xs text-[#001433]/50">{RESEARCH_TOPIC_BRIEF_GRADE_LEGEND}</p>
      </section>

      {sections.generatedAt ? (
        <p className="text-xs text-[#001433]/50">
          Oppdatert{' '}
          <time dateTime={sections.generatedAt} className="tabular-nums">
            {formatResearchTopicBriefGeneratedAt(sections.generatedAt)}
          </time>
        </p>
      ) : null}
    </div>
  );
}
