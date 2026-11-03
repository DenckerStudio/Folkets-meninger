import { expireStaleResearchBriefs } from '@/lib/admin/research/service';
import { expireStaleResearchTopics } from '@/lib/admin/research/topic-service';

export const RESEARCH_BRIEF_EXPIRE_THROTTLE_MS = 60_000;

let lastExpireAttemptMs = 0;

/** Kun for tester — nullstiller prosess-throttle. */
export function resetResearchBriefExpireThrottleForTests(): void {
  lastExpireAttemptMs = 0;
}

export async function expireStaleResearchBriefsThrottled(
  options?: {
    nowMs?: number;
    expire?: typeof expireStaleResearchBriefs;
  },
): Promise<{ ran: boolean }> {
  const nowMs = options?.nowMs ?? Date.now();
  if (nowMs - lastExpireAttemptMs < RESEARCH_BRIEF_EXPIRE_THROTTLE_MS) {
    return { ran: false };
  }
  lastExpireAttemptMs = nowMs;
  const expire = options?.expire ?? expireStaleResearchBriefs;
  try {
    await expire();
    await expireStaleResearchTopics();
  } catch (error) {
    console.warn('[research] research_briefs_expire_stale failed:', error);
  }
  return { ran: true };
}
