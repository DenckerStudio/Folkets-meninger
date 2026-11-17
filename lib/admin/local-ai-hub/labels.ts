export const LOCAL_AI_LABEL_TITLES = {
  queued: 'lokal-ai',
  pr: 'lokal-ai-pr',
  forslag: 'lokal-ai-forslag',
  feilet: 'lokal-ai-feilet',
  avvist: 'lokal-ai-avvist',
} as const;

export type LocalAiLabelKey = keyof typeof LOCAL_AI_LABEL_TITLES;

export const LOCAL_AI_BRANCH_PREFIX = 'lokal-ai/vikunja-';

export const LOCAL_AI_GITHUB_REPO = {
  owner: 'DenckerStudio',
  repo: 'Folkets-meninger',
} as const;

export const LOCAL_AI_FETCH_TIMEOUT_MS = 12_000;