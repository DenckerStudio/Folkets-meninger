import type { OpinionListItem } from '@/lib/opinions/types';
import {
  OPINION_INNSPILL_PACKAGE_DISCLAIMER,
  type OpinionInnspillHearingLink,
  type OpinionInnspillPackage,
  type OpinionInnspillRecord,
} from './types';

export function buildOpinionInnspillPackage(input: {
  innspill: OpinionInnspillRecord;
  opinion: Pick<OpinionListItem, 'title' | 'body' | 'points'>;
  sakId: string;
  sakTitle: string;
  hearing?: OpinionInnspillHearingLink | null;
  generatedAt?: string;
}): OpinionInnspillPackage {
  const points = input.opinion.points.map((point) => ({
    stance: point.stance,
    text: point.text,
  }));

  return {
    kind: 'motforslag_horingsinnspill',
    disclaimer: OPINION_INNSPILL_PACKAGE_DISCLAIMER,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sak: {
      id: input.sakId,
      title: input.sakTitle,
    },
    hearing: {
      id: input.hearing?.id ?? input.innspill.stortingetHearingId,
      title: input.hearing?.title ?? null,
      komite: input.hearing?.komite ?? null,
      deadlineAt: input.hearing?.deadlineAt ?? input.innspill.hearingDeadlineAt,
    },
    proposal: {
      id: input.innspill.opinionId,
      title: input.opinion.title,
      body: input.opinion.body,
      points,
      supportCount: input.innspill.supportCount,
      supportThreshold: input.innspill.supportThreshold,
      authorName: input.innspill.authorName,
    },
  };
}

export function opinionInnspillPackageToMarkdown(pkg: OpinionInnspillPackage): string {
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
  ];

  if (pkg.proposal.points.length > 0) {
    lines.push('### Argumenter', '');
    for (const point of pkg.proposal.points) {
      lines.push(`- **${point.stance === 'for' ? 'For' : 'Imot'}:** ${point.text}`);
    }
    lines.push('');
  }

  lines.push('---', '', pkg.disclaimer);
  return lines.filter((line) => line !== null).join('\n');
}

export function canPackageOpinionInnspill(
  innspill: Pick<OpinionInnspillRecord, 'status' | 'supportCount' | 'supportThreshold'>,
): boolean {
  if (innspill.status === 'withdrawn') return false;
  if (innspill.status === 'packaged') return false;
  return innspill.supportCount >= innspill.supportThreshold;
}
