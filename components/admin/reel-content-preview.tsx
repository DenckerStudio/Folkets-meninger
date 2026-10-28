import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { ReelCandidateRatings } from '@/components/admin/reel-candidate-ratings';
import { listReelPollSourceLinks } from '@/lib/polls/reel-source-links';
import type { PollRecord } from '@/lib/polls/types';

export function ReelContentPreview({ poll }: { poll: PollRecord }) {
  const sources = listReelPollSourceLinks(poll);
  const description = poll.neutralSummary.trim();

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tittel</p>
        <h4 className="mt-1 text-base font-semibold break-words text-foreground">
          {poll.title.trim() || 'Uten tittel'}
        </h4>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Beskrivelse</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed break-words text-muted-foreground">
          {description || 'Ingen beskrivelse er lagret for dette utkastet.'}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Kilder</p>
        {sources.length > 0 ? (
          <ul className="mt-1 space-y-1.5 text-sm">
            {sources.map((source) => (
              <li key={source.id}>
                {source.external ? (
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 font-medium text-brand hover:underline"
                  >
                    <span className="min-w-0 wrap-anywhere">{source.label}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </a>
                ) : (
                  <Link href={source.href} className="font-medium wrap-anywhere text-brand hover:underline">
                    {source.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Ingen kilder er lagret for dette utkastet.</p>
        )}
      </div>
      <ReelCandidateRatings metadata={poll.generationMetadata} />
    </div>
  );
}
