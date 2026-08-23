export type PollTrack = 'stortinget' | 'citizen' | 'system';
export type PollStatus = 'draft' | 'open' | 'closed' | 'archived';
export type PollChoice = 'ja' | 'nei' | 'blank';
export type InitiativeStatus = 'gathering' | 'threshold_met' | 'promoted' | 'rejected' | 'withdrawn';

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
  [key: string]: unknown;
};

export type PollRecord = {
  id: string;
  track: PollTrack;
  status: PollStatus;
  title: string;
  neutralSummary: string;
  sourceUrls: PollSourceUrl[];
  stortingetIssueId: string | null;
  citizenInitiativeId: string | null;
  opensAt: string | null;
  closesAt: string | null;
  createdAt: string;
  generationMetadata: PollGenerationMetadata;
};

export type CitizenInitiativeRecord = {
  id: string;
  title: string;
  body: string;
  authorUserId: string;
  supportThreshold: number;
  supportCount: number;
  status: InitiativeStatus;
  promotedPollId: string | null;
  createdAt: string;
};

export type SakPollCoverage = {
  pendingIssues: number;
  pendingWithRag: number;
  pendingWithPoll: number;
  sakCandidates: number;
};

export type SakPollCandidate = {
  issueId: string;
  title: string;
  summary: string;
  lastUpdatedAt: string | null;
  ragChunkCount: number;
};
