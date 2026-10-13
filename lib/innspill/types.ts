import type { OpinionStance, OpinionStanceCounts } from '@/lib/opinions/types';

export type OpinionInnspillStatus = 'gathering' | 'threshold_met' | 'packaged' | 'withdrawn';

export type OpinionInnspillRecord = {
  opinionId: string;
  authorUserId: string;
  authorName: string | null;
  status: OpinionInnspillStatus;
  supportThreshold: number;
  supportCount: number;
  stortingetHearingId: string | null;
  hearingDeadlineAt: string | null;
  packagedAt: string | null;
  createdAt: string;
};

export type OpinionInnspillHearingLink = {
  id: string;
  title: string;
  komite: string | null;
  deadlineAt: string | null;
  deadlineLabel: string | null;
  open: boolean;
};

/**
 * The payload sent to N8N_HEARING_INNSPILL_WEBHOOK_URL when a Folkets meninger
 * opinion is packaged as a hearing innspill. Shape is identical to the retired
 * counter_proposals payload so existing n8n workflows keep working.
 */
export type OpinionInnspillPackage = {
  kind: 'motforslag_horingsinnspill';
  disclaimer: string;
  generatedAt: string;
  sak: {
    id: string;
    title: string;
  };
  hearing: {
    id: string | null;
    title: string | null;
    komite: string | null;
    deadlineAt: string | null;
  };
  proposal: {
    id: string;
    title: string;
    body: string;
    points: { stance: OpinionStance; text: string }[];
    supportCount: number;
    supportThreshold: number;
    authorName: string | null;
  };
};

export type OpinionInnspillSummary = {
  total: number;
  gathering: number;
  packaged: number;
  counts: OpinionStanceCounts;
};

export const OPINION_INNSPILL_PACKAGE_DISCLAIMER =
  'Dette er et strukturert borgeraggregat fra Folkets Meninger. Det er ikke sendt inn via et Stortinget-API. Offisielt innspill må lastes opp eller sendes via stortinget.no før innspillsfristen.';

export const OPINION_INNSPILL_DEFAULT_THRESHOLD = 10;

export function innspillStatusLabel(status: OpinionInnspillStatus): string {
  switch (status) {
    case 'gathering':
      return 'Samler støtte';
    case 'threshold_met':
      return 'Terskel nådd';
    case 'packaged':
      return 'Pakket som innspill';
    case 'withdrawn':
      return 'Trukket';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
