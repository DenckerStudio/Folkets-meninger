export type ResearchBriefKind = 'deepen' | 'blog' | 'reel';

export type ResearchBriefStatus = 'queued' | 'running' | 'done' | 'failed';

export type ResearchPerspectiveStance = 'for' | 'mot' | 'nøytral';

export type ResearchActorType = 'parti' | 'organisasjon' | 'medie' | 'person' | 'annet';

export type ResearchPerspectiveQuote = {
  text: string;
  url: string;
  publisher: string | null;
};

export type ResearchPerspective = {
  actor: string;
  actor_type: ResearchActorType;
  stance: ResearchPerspectiveStance;
  summary: string;
  quotes: ResearchPerspectiveQuote[];
  /** Om perspektivet er uavhengig av klyngen (valgfritt, fra n8n). */
  independent?: boolean;
};

export type ResearchBriefSource = {
  url: string;
  publisher: string | null;
  title: string | null;
  published_at: string | null;
  excerpt: string | null;
};

export type ResearchBriefDetails = {
  open_questions?: string[];
  unverified?: string[];
  [key: string]: unknown;
};

export type ResearchBriefRow = {
  id: string;
  request_id: string;
  cluster_id: string;
  kind: ResearchBriefKind;
  status: ResearchBriefStatus;
  summary: string | null;
  perspectives: ResearchPerspective[];
  sources: ResearchBriefSource[];
  details: ResearchBriefDetails;
  output_ref: string | null;
  error: string | null;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ResearchWebhookClusterSource = {
  url: string;
  publisher: string | null;
  title: string | null;
  published_at: string | null;
  source_type: string | null;
};

export type ResearchWebhookBody = {
  request_id: string;
  kind: ResearchBriefKind;
  cluster_id: string;
  action_key: string;
  requested_by: string;
  requested_at: string;
  cluster: {
    title: string;
    summary: string | null;
    status: string;
    sources: ResearchWebhookClusterSource[];
  };
  latest_brief?: {
    summary: string | null;
    perspectives: ResearchPerspective[];
    sources: ResearchBriefSource[];
  };
};
