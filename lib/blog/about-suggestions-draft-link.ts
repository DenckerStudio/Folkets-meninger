import { aboutBlogSourceEvent } from '@/lib/blog/about-draft';
import type { AboutSuggestionFeedback } from '@/lib/blog/about-suggestions';
import {
  feedbackFromStored,
  reopenAboutSuggestion,
  type AboutSuggestionStored,
} from '@/lib/blog/about-suggestions-store';
import type { BlogOpsLookupResult } from '@/lib/cms/blog-ops-client';

export function aboutSuggestionSourceEvent(row: AboutSuggestionStored): string | null {
  if (row.sourceEvent?.trim()) return row.sourceEvent.trim();
  if (row.draftRequestId?.trim()) return aboutBlogSourceEvent(row.draftRequestId.trim());
  return null;
}

export async function resolveAboutSuggestionUsedHasDraft(
  row: AboutSuggestionStored,
  lookupPost: (args: { sourceEvent?: string }) => Promise<BlogOpsLookupResult | null>,
): Promise<boolean | undefined> {
  if (row.status !== 'used') return undefined;
  const sourceEvent = aboutSuggestionSourceEvent(row);
  if (!sourceEvent) return false;
  const hit = await lookupPost({ sourceEvent });
  if (hit === null) return undefined;
  return hit.found;
}

export async function enrichAboutSuggestionFeedback(args: {
  rows: AboutSuggestionStored[];
  lookupPost: (args: { sourceEvent?: string }) => Promise<BlogOpsLookupResult | null>;
}): Promise<AboutSuggestionFeedback[]> {
  const feedback = feedbackFromStored(args.rows);
  const rowByKey = new Map(args.rows.map((row) => [row.key, row]));
  return Promise.all(
    feedback.map(async (row) => {
      if (row.status !== 'used' || row.usedHasDraft !== undefined) return row;
      const stored = rowByKey.get(row.key);
      if (!stored) return row;
      const usedHasDraft = await resolveAboutSuggestionUsedHasDraft(stored, args.lookupPost);
      if (usedHasDraft === undefined) return row;
      return { ...row, usedHasDraft };
    }),
  );
}

export async function reconcileOrphanAboutSuggestions(args: {
  rows: AboutSuggestionStored[];
  lookupPost: (args: { sourceEvent?: string }) => Promise<BlogOpsLookupResult | null>;
  reopen?: typeof reopenAboutSuggestion;
}): Promise<AboutSuggestionStored[]> {
  const reopen = args.reopen ?? reopenAboutSuggestion;
  const next: AboutSuggestionStored[] = [];
  for (const row of args.rows) {
    if (row.status !== 'used') {
      next.push(row);
      continue;
    }
    const usedHasDraft = await resolveAboutSuggestionUsedHasDraft(row, args.lookupPost);
    if (usedHasDraft !== false) {
      next.push(row);
      continue;
    }
    const opened = await reopen(row.key);
    if (!opened.ok) {
      next.push(row);
      continue;
    }
    next.push({
      ...row,
      status: 'open',
      draftRequestId: null,
      sourceEvent: null,
      snoozeUntil: null,
    });
  }
  return next;
}