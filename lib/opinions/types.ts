export const OPINION_STANCES = ['for', 'blank', 'imot'] as const;

export type OpinionStance = (typeof OPINION_STANCES)[number];

export const OPINION_TITLE_MIN = 5;
export const OPINION_TITLE_MAX = 200;
export const OPINION_BODY_MIN = 250;
export const OPINION_BODY_MAX = 4000;
export const OPINION_REPLY_BODY_MIN = 80;
export const OPINION_LIST_PAGE_SIZE = 40;

export type OpinionStanceCounts = {
  for: number;
  blank: number;
  imot: number;
  total: number;
};

export type OpinionListItem = {
  id: string;
  title: string;
  body: string;
  stance: OpinionStance;
  stortingetIssueId: string | null;
  issueTitle: string | null;
  createdAt: string;
  authorUserId: string;
  authorName: string | null;
  authorInitials: string;
  counts: OpinionStanceCounts;
};

export type OpinionReplyItem = {
  id: string;
  opinionId: string;
  stance: OpinionStance;
  body: string;
  createdAt: string;
  updatedAt: string;
  authorUserId: string;
  authorName: string | null;
  authorInitials: string;
};

export type OpinionDetail = OpinionListItem & {
  replies: OpinionReplyItem[];
  viewerReply: OpinionReplyItem | null;
};

export type SakPickerOption = {
  id: string;
  title: string;
  category: string | null;
};
