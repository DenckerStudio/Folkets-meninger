import type { ContentFeedbackAspects } from '@/lib/content-feedback/types';

export const CONTENT_FEEDBACK_ASPECT_KEYS = [
  'title',
  'description',
  'sources',
  'topic',
  'tone',
  'relevance',
  'timing',
  'language',
] as const;

export type ContentFeedbackAspectKey = (typeof CONTENT_FEEDBACK_ASPECT_KEYS)[number];

export const CONTENT_FEEDBACK_ASPECT_LABELS: Record<ContentFeedbackAspectKey, string> = {
  title: 'Tittel',
  description: 'Beskrivelse',
  sources: 'Kilder',
  topic: 'Tema',
  tone: 'Tone',
  relevance: 'Relevans',
  timing: 'Timing',
  language: 'Språk',
};

export const CONTENT_FEEDBACK_REASON_TAGS = [
  { tag: 'for_gammel', label: 'For gammel' },
  { tag: 'duplikat', label: 'Duplikat' },
  { tag: 'svak_kilde', label: 'Svak kilde' },
  { tag: 'klikkagn', label: 'Klikkagn' },
  { tag: 'feil_tema', label: 'Feil tema' },
  { tag: 'feil_tone', label: 'Feil tone' },
  { tag: 'upresist', label: 'Upresist' },
  { tag: 'irrelevant', label: 'Irrelevant' },
] as const;

export type ContentFeedbackReasonTag = (typeof CONTENT_FEEDBACK_REASON_TAGS)[number]['tag'];

export const ADMIN_CONTENT_FEEDBACK_TYPES = [
  'reel',
  'ai_summary',
  'blog_post',
  'poll',
  'action',
  'source_item',
] as const;

export function emptyAspects(): ContentFeedbackAspects {
  return {};
}

export function hasNegativeAspect(aspects: ContentFeedbackAspects): boolean {
  return CONTENT_FEEDBACK_ASPECT_KEYS.some((key) => aspects[key] === '-');
}
