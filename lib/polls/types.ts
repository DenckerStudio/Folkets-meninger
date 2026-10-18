export type PollTrack = 'stortinget' | 'citizen' | 'system';
export type PollKind = 'sak' | 'aksjon';
export type PollStatus = 'draft' | 'open' | 'closed' | 'archived';
export type PollChoice = 'ja' | 'nei' | 'blank';
export type PollScaleUnit = 'medlemmer' | 'underskrifter' | 'deltakere' | 'kroner';

export type PollSourceUrl = {
  label?: string;
  url: string;
};

export type PollTotals = {
  ja: number;
  nei: number;
  blank: number;
  total: number;
};

export type PollFylkeTotals = {
  code: string;
  name: string;
  ja: number | null;
  nei: number | null;
  blank: number | null;
  total: number;
  sufficientData: boolean;
};

export type PollGenerationMetadata = {
  source_type?: string;
  confidence?: string;
  rag_chunk_count?: number;
  rag_chunks?: unknown[];
  political_choice?: string;
  model?: string;
  candidate_ratings?: unknown;
  [key: string]: unknown;
};

export type SystemReelFeedItem = {
  poll: PollRecord;
  totals: PollTotals;
  userVote: PollChoice | null;
};

export type PollRecord = {
  id: string;
  track: PollTrack;
  pollKind: PollKind;
  status: PollStatus;
  title: string;
  neutralSummary: string;
  sourceUrls: PollSourceUrl[];
  stortingetIssueId: string | null;
  citizenInitiativeId: string | null;
  actionClusterId: string | null;
  relatedIssueId: string | null;
  sourceUrl: string | null;
  scaleValue: number | null;
  scaleUnit: PollScaleUnit | null;
  scaleSourceUrl: string | null;
  scaleAsOf: string | null;
  opensAt: string | null;
  closesAt: string | null;
  createdAt: string;
  updatedAt: string;
  generationMetadata: PollGenerationMetadata;
};

export type SakPollCoverage = {
  pendingIssues: number;
  pendingWithRag: number;
  pendingWithPoll: number;
  sakCandidates: number;
};

export type SakPollSourceKind = 'rag' | 'ai_summary' | 'metadata';

export type SakPollCandidate = {
  issueId: string;
  title: string;
  summary: string;
  lastUpdatedAt: string | null;
  ragChunkCount: number;
  hasAiSummary: boolean;
  sourceKind: SakPollSourceKind;
};
