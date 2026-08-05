export type PollTrack = 'stortinget' | 'citizen';
export type PollStatus = 'draft' | 'open' | 'closed' | 'archived';
export type PollChoice = 'ja' | 'nei' | 'blank';
export type ArgumentStance = 'ja' | 'nei' | 'neutral';

export type InitiativeStatus =
  | 'gathering'
  | 'threshold_met'
  | 'promoted'
  | 'rejected'
  | 'withdrawn';

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

export type PollArgument = {
  id: string;
  body: string;
  stance: 'ja' | 'nei';
  likeCount: number;
  dislikeCount: number;
  netUpvotes: number;
  authorName: string | null;
  createdAt: string;
};

export type PollTopArguments = {
  ja: PollArgument[];
  nei: PollArgument[];
};

export type PollRecord = {
  id: string;
  track: PollTrack;
  status: PollStatus;
  title: string;
  neutralSummary: string;
  sourceUrls: { label?: string; url: string }[];
  stortingetIssueId: string | null;
  forumThreadId: string | null;
  citizenInitiativeId: string | null;
  opensAt: string | null;
  closesAt: string | null;
  createdAt: string;
};

export type CitizenInitiativeRecord = {
  id: string;
  title: string;
  body: string;
  forumThreadId: string;
  authorUserId: string;
  supportThreshold: number;
  supportCount: number;
  status: InitiativeStatus;
  promotedPollId: string | null;
  createdAt: string;
};

export type NorwayCounty = {
  code: string;
  name: string;
  sortOrder: number;
};
