import {
  COUNTER_PROPOSAL_PACKAGE_DISCLAIMER,
  type CounterProposalPackage,
  type CounterProposalRecord,
} from './types';

export function buildCounterProposalPackage(input: {
  proposal: CounterProposalRecord;
  sakTitle: string;
  hearing?: {
    id: string | null;
    title: string | null;
    komite: string | null;
    deadlineAt: string | null;
  };
  generatedAt?: string;
}): CounterProposalPackage {
  return {
    kind: 'motforslag_horingsinnspill',
    disclaimer: COUNTER_PROPOSAL_PACKAGE_DISCLAIMER,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sak: {
      id: input.proposal.stortingetIssueId,
      title: input.sakTitle,
    },
    hearing: {
      id: input.hearing?.id ?? input.proposal.stortingetHearingId,
      title: input.hearing?.title ?? null,
      komite: input.hearing?.komite ?? null,
      deadlineAt: input.hearing?.deadlineAt ?? input.proposal.hearingDeadlineAt,
    },
    proposal: {
      id: input.proposal.id,
      title: input.proposal.title,
      body: input.proposal.body,
      supportCount: input.proposal.supportCount,
      supportThreshold: input.proposal.supportThreshold,
      authorName: input.proposal.authorName,
    },
  };
}

export function counterProposalPackageToMarkdown(pkg: CounterProposalPackage): string {
  const lines = [
    `# Motforslag til sak ${pkg.sak.id}`,
    '',
    `**Sak:** ${pkg.sak.title}`,
    pkg.hearing.komite ? `**Komité:** ${pkg.hearing.komite}` : null,
    pkg.hearing.id ? `**Høring:** ${pkg.hearing.id}` : null,
    pkg.hearing.deadlineAt ? `**Innspillsfrist:** ${pkg.hearing.deadlineAt}` : null,
    `**Støtte:** ${pkg.proposal.supportCount} av ${pkg.proposal.supportThreshold}`,
    pkg.proposal.authorName ? `**Forslagsstiller:** ${pkg.proposal.authorName}` : null,
    `**Pakket:** ${pkg.generatedAt}`,
    '',
    '## Forslag',
    '',
    `### ${pkg.proposal.title}`,
    '',
    pkg.proposal.body,
    '',
    '---',
    '',
    pkg.disclaimer,
  ];
  return lines.filter((line) => line !== null).join('\n');
}

export function canPackageCounterProposal(proposal: Pick<
  CounterProposalRecord,
  'status' | 'supportCount' | 'supportThreshold'
>): boolean {
  if (proposal.status === 'withdrawn') return false;
  return proposal.supportCount >= proposal.supportThreshold;
}
