export type CounterProposalStatus = 'gathering' | 'threshold_met' | 'packaged' | 'withdrawn';

export type CounterProposalRecord = {
  id: string;
  stortingetIssueId: string;
  authorUserId: string;
  authorName: string | null;
  title: string;
  body: string;
  status: CounterProposalStatus;
  supportThreshold: number;
  supportCount: number;
  stortingetHearingId: string | null;
  hearingDeadlineAt: string | null;
  packagedAt: string | null;
  createdAt: string;
};

export type CounterProposalHearingLink = {
  id: string;
  title: string;
  komite: string | null;
  deadlineAt: string | null;
  deadlineLabel: string | null;
  open: boolean;
};

export type CounterProposalPackage = {
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
    supportCount: number;
    supportThreshold: number;
    authorName: string | null;
  };
};

export const COUNTER_PROPOSAL_PACKAGE_DISCLAIMER =
  'Dette er et strukturert borgeraggregat fra Folkets Stemme. Det er ikke sendt inn via et Stortinget-API. Offisielt innspill må lastes opp eller sendes via stortinget.no før innspillsfristen.';

export const COUNTER_PROPOSAL_DEFAULT_THRESHOLD = 10;
export const COUNTER_PROPOSAL_TITLE_MIN = 5;
export const COUNTER_PROPOSAL_BODY_MIN = 40;
