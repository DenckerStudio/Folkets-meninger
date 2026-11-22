import type { RedditSignalApiAction, RedditSignalSortKey, RedditSignalStatus } from '@/lib/reddit-signals/types';

export const REDDIT_SIGNAL_STATUS_LABELS: Record<RedditSignalStatus, string> = {
  ny: 'Ny',
  brukt: 'Brukt',
  ignorert: 'Ignorert',
  auto_ignorert: 'Auto ignorert',
  blokkert: 'Blokkert',
};

export const REDDIT_SIGNAL_SORT_LABELS: Record<RedditSignalSortKey, string> = {
  score: 'Poeng',
  comments: 'Kommentarer',
  contention: 'Kommentarer per poeng',
  relevance: 'Relevans',
  reply_worth: 'Svarverdi',
  engagement: 'Engasjement',
  growth24h: 'Vekst siste 24 t',
};

export const REDDIT_SIGNAL_ACTION_LABELS: Record<RedditSignalApiAction, string> = {
  ignorer: 'Ignorer',
  blokker: 'Blokker permanent',
  marker_brukt: 'Marker brukt',
};