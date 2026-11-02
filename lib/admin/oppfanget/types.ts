export type ActionClusterDbStatus =
  | 'candidate'
  | 'below_threshold'
  | 'manual_only'
  | 'blocked'
  | 'would_draft'
  | 'drafted'
  | 'rejected'
  | 'not_action';

export type ActionTypeDb =
  | 'boykott'
  | 'opprop'
  | 'demonstrasjon'
  | 'innsamling'
  | 'kampanje';

export type OppfangetDisplayType = 'melding' | 'opprop' | 'aksjon' | 'boikott' | 'reddit';

export type RedditSignalSubreddit = 'norge' | 'norske' | 'Nordmenn';

export type OppfangetDisplayStatus =
  | 'oppfanget'
  | 'under_terskel'
  | 'utkast_laget'
  | 'publisert'
  | 'avvist';

export type OppfangetSourceType = 'news_rss' | 'reddit' | 'petition' | 'searxng';

export type OppfangetSourceRow = {
  id: string;
  url: string;
  publisher: string | null;
  signalOnly: boolean;
  title: string | null;
  sourceType: OppfangetSourceType | null;
};

export type OppfangetScale = {
  value: number | null;
  unit: string | null;
  sourceUrl: string | null;
  asOf: string | null;
};

export type OppfangetClusterRow = {
  rowKind?: 'cluster';
  id: string;
  title: string;
  displayType: Exclude<OppfangetDisplayType, 'reddit'>;
  displayStatus: OppfangetDisplayStatus;
  clusterStatus: ActionClusterDbStatus;
  actionType: ActionTypeDb;
  sources: OppfangetSourceRow[];
  firstSeenAt: string;
  lastSeenAt: string;
  scale: OppfangetScale | null;
  confidence: number | null;
  sensitive: boolean;
  sensitiveCategory: string | null;
  pollId: string | null;
  pollStatus: string | null;
};

export type OppfangetRedditRow = {
  rowKind: 'reddit';
  id: string;
  title: string;
  displayType: 'reddit';
  firstSeenAt: string;
  lastSeenAt: string;
  subreddit: RedditSignalSubreddit;
  redditId: string;
  url: string;
  score: number;
  numComments: number;
  contention: number;
  postedAt: string;
  snapshotAt: string;
  topic: string | null;
  relatedIssueId: string | null;
  relatedSimilarity: number | null;
};

export type OppfangetRow = OppfangetClusterRow | OppfangetRedditRow;

export function isOppfangetRedditRow(row: OppfangetRow): row is OppfangetRedditRow {
  return row.rowKind === 'reddit';
}

export type OppfangetStatusCounts = Record<OppfangetDisplayStatus, number>;

export type OppfangetListResponse = {
  rows: OppfangetRow[];
  counts: OppfangetStatusCounts;
  tableMissing: boolean;
  tableMissingMessage: string | null;
  previewMock: boolean;
};
