import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { PublicResearchTopicListItem } from '@/lib/research-topics/public-map';
import { routes } from '@/lib/routes';

type PublicResearchTopicCardProps = {
  topic: PublicResearchTopicListItem;
};

export function PublicResearchTopicCard({ topic }: PublicResearchTopicCardProps) {
  const href = routes.detteSnakkesDetOmTopic(topic.id);
  return (
    <Link
      href={href}
      className="group flex h-full min-h-0 flex-col rounded-2xl border border-[#00205b]/10 bg-white overflow-hidden transition-all hover:border-[#00205b]/30 hover:shadow-[0_8px_30px_rgba(0,32,91,0.06)]"
    >
      <div className="flex flex-grow flex-col p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#ba0c2f]">
          Tema
        </p>
        <h3 className="text-xl font-semibold text-[#001433] mb-2 transition-colors group-hover:text-[#ba0c2f] line-clamp-3">
          {topic.topicTitle}
        </h3>
        {topic.teaser ? (
          <p className="text-[#001433]/65 line-clamp-3 mb-4">{topic.teaser}</p>
        ) : (
          <p className="mb-4 text-sm text-[#001433]/50">Les oppsummerte funn fra kildene.</p>
        )}
        <span className="mt-auto text-sm font-semibold text-[#00205b] flex items-center transition-colors group-hover:text-[#ba0c2f]">
          Les mer <ArrowRight className="ml-1 w-4 h-4" aria-hidden />
        </span>
      </div>
      {(topic.sakId || topic.pollId) && (
        <div className="border-t border-[#00205b]/8 bg-[#00205b]/[0.02] px-6 py-3 text-xs text-[#001433]/60">
          {topic.pollId ? 'Har tilknyttet avstemning' : 'Har tilknyttet sak'}
        </div>
      )}
    </Link>
  );
}
