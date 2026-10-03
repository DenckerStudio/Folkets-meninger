export const SUGGESTION_BODY_MIN = 10;
export const SUGGESTION_BODY_MAX = 500;

export const SUGGESTION_STATUSES = ['new', 'handled'] as const;

export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export type SuggestionRecord = {
  id: string;
  userId: string;
  body: string;
  status: SuggestionStatus;
  createdAt: string;
  handledAt: string | null;
  handledBy: string | null;
  authorName: string | null;
};

export function isSuggestionStatus(value: unknown): value is SuggestionStatus {
  return value === 'new' || value === 'handled';
}

export function suggestionStatusLabel(status: SuggestionStatus): string {
  switch (status) {
    case 'new':
      return 'Ny';
    case 'handled':
      return 'Behandlet';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
