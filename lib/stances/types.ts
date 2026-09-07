export const ISSUE_STANCES = ['enig', 'uenig', 'ikke_interessert'] as const;

export type IssueStance = (typeof ISSUE_STANCES)[number];

export const ISSUE_STANCE_LABELS: Record<IssueStance, string> = {
  enig: 'Enig',
  uenig: 'Uenig',
  ikke_interessert: 'Ikke interessert',
};

export function isIssueStance(value: unknown): value is IssueStance {
  return typeof value === 'string' && ISSUE_STANCES.includes(value as IssueStance);
}

export type StanceHistoryItem = {
  stortinget_issue_id: string;
  title?: string | null;
  stance: IssueStance;
  updated_at: string;
};

export type StanceSignal = {
  value: string;
  count: number;
};

export type StanceSignals = {
  categories: StanceSignal[];
  labels: StanceSignal[];
};
