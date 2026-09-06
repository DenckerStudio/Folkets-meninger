'use client';

import Link from 'next/link';
import { CheckCircle2, ChevronRight, FileSignature, Scale } from 'lucide-react';
import { useCallback, useState } from 'react';
import VotingSection from '@/app/dashboard/sak/[id]/voting-section';
import {
  motforslagCtaForVote,
  participationStepLabel,
  SAK_PARTICIPATION_STEPS,
  type SakParticipationSummary,
} from '@/lib/sak-participation';
import { routes } from '@/lib/routes';
import { navigateToSakTab } from '@/components/sak/sak-page-tabs';

type VoteTotals = {
  for: number;
  against: number;
  abstain: number;
  total: number;
};

export function SakParticipationFlow({
  sakId,
  sakTitle,
  sakSummary,
  initialVotes,
  votingClosed,
  votingDaysLeft,
  participation,
}: {
  sakId: string;
  sakTitle: string;
  sakSummary: string;
  initialVotes: VoteTotals;
  votingClosed: boolean;
  votingDaysLeft: number | null;
  participation: SakParticipationSummary;
}) {
  const [userVote, setUserVote] = useState<'for' | 'against' | 'abstain' | null>(null);

  const goToMotforslag = useCallback(() => {
    navigateToSakTab('motforslag');
  }, []);

  const voteComplete = Boolean(userVote) || votingClosed;
  const activeStep = voteComplete ? (participation.proposalCount > 0 ? 'motforslag' : 'innspill') : 'vote';

  return (
    <section className="space-y-4" aria-label="Din mening på saken">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-foreground sm:text-xl">Din mening på saken</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Stem, utforsk motforslag og send innspill — alt knyttet til denne saken.
        </p>

        <ol className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {SAK_PARTICIPATION_STEPS.map((step, index) => {
            const isActive = step === activeStep;
            const isDone =
              (step === 'vote' && voteComplete) ||
              (step === 'motforslag' && participation.proposalCount > 0);
            return (
              <li key={step} className="flex items-center gap-2 text-sm">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${
                    isActive
                      ? 'bg-brand/10 text-brand'
                      : isDone
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                  {index + 1}. {participationStepLabel(step)}
                </span>
                {index < SAK_PARTICIPATION_STEPS.length - 1 ? (
                  <ChevronRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      <VotingSection
        initialVotes={initialVotes}
        sakId={sakId}
        sakTitle={sakTitle}
        sakSummary={sakSummary}
        votingClosed={votingClosed}
        votingDaysLeft={votingDaysLeft}
        onVoteCast={setUserVote}
      />

      {voteComplete ? (
        <div className="rounded-2xl border border-brand/20 bg-brand/5 p-4 sm:p-5">
          <p className="text-sm font-medium text-foreground">
            {motforslagCtaForVote(userVote)}
          </p>
          <button
            type="button"
            onClick={goToMotforslag}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            <Scale className="h-4 w-4" />
            Gå til motforslag
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {(participation.proposalCount > 0 || participation.hearingOpen) && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Borgernes innspill</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {participation.proposalCount === 0
                  ? 'Ingen motforslag ennå.'
                  : `${participation.proposalCount} motforslag${
                      participation.proposalCount === 1 ? '' : ''
                    } på denne saken`}
              </p>
            </div>
            <button
              type="button"
              onClick={goToMotforslag}
              className="text-sm font-medium text-brand hover:underline"
            >
              Se alle
            </button>
          </div>

          {participation.topProposal ? (
            <div className="mt-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
              <p className="text-sm font-medium text-foreground">{participation.topProposal.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {participation.topProposal.supportCount} av {participation.topProposal.supportThreshold}{' '}
                støtter
              </p>
            </div>
          ) : null}

          {participation.hearingOpen && participation.hearingId ? (
            <Link
              href={routes.horing(participation.hearingId)}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
            >
              <FileSignature className="h-4 w-4" />
              Åpen høring: {participation.hearingTitle}
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
