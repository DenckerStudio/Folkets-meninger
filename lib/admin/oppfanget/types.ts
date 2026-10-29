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

export type OppfangetDisplayType = 'melding' | 'opprop' | 'aksjon' | 'boikott';

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

export type OppfangetRow = {
  id: string;
  title: string;
  displayType: OppfangetDisplayType;
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

export type OppfangetStatusCounts = Record<OppfangetDisplayStatus, number>;

export type OppfangetListResponse = {
  rows: OppfangetRow[];
  counts: OppfangetStatusCounts;
  tableMissing: boolean;
  tableMissingMessage: string | null;
  previewMock: boolean;
};
