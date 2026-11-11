export const DEV_TASK_PROPOSAL_STATUSES = [
  'til_godkjenning',
  'i_prosess',
  'ferdig',
  'avslatt',
] as const;

export type DevTaskProposalStatus = (typeof DEV_TASK_PROPOSAL_STATUSES)[number];

export const DEV_TASK_PROPOSAL_RISKS = ['low', 'normal'] as const;

export type DevTaskProposalRisk = (typeof DEV_TASK_PROPOSAL_RISKS)[number];

export const DEV_TASK_PROPOSAL_DECISION_ACTIONS = ['godkjenn', 'avslå'] as const;

export type DevTaskProposalDecisionAction = (typeof DEV_TASK_PROPOSAL_DECISION_ACTIONS)[number];

export type DevTaskProposalRow = {
  id: string;
  title: string;
  body: string | null;
  source: string;
  signal_ref: string | null;
  dedupe_key: string;
  risk: DevTaskProposalRisk;
  status: DevTaskProposalStatus;
  decided_by: string | null;
  decided_at: string | null;
  pr_url: string | null;
  slack_ts: string | null;
  slack_posted_at: string | null;
  created_at: string;
  updated_at: string;
};
