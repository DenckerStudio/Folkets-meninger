export type ActionClusterStatus =
  | 'candidate'
  | 'below_threshold'
  | 'manual_only'
  | 'blocked'
  | 'would_draft'
  | 'drafted'
  | 'rejected'
  | 'not_action';

export type ActionType = 'boykott' | 'opprop' | 'demonstrasjon' | 'innsamling' | 'kampanje';

export type ActionClusterRecord = {
  id: string;
  actionKey: string;
  actionType: ActionType;
  actionName: string;
  topic: string | null;
  target: string | null;
  descriptionNb: string;
  sensitiveCategory: string | null;
  status: ActionClusterStatus;
  verdictReasons: unknown[];
  independentPublishers: string[];
  nationalCoverage: boolean;
  maxConfidence: number | null;
  bestScale: Record<string, unknown> | null;
  relatedIssueId: string | null;
  relatedSimilarity: number | null;
  pollId: string | null;
  rejectReason: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  metadata: Record<string, unknown>;
};

export type ActionSourceRecord = {
  id: string;
  clusterId: string;
  itemKey: string;
  urlCanonical: string;
  sourceType: string | null;
  publisher: string | null;
  signalOnly: boolean;
  title: string | null;
  excerpt: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  confidence: number | null;
};
