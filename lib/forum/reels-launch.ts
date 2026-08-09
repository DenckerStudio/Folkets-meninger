/** Minimum active reels recommended before treating public launch as ready. */
export const REELS_PUBLIC_LAUNCH_MIN_ACTIVE = 8;

export type ReelDraftLike = {
  id: string;
  stortinget_issue_id?: string | null;
  generation_metadata?: {
    source_type?: string;
    confidence?: string;
    rag_chunk_count?: number;
  } | null;
  created_at?: string;
};

export type ReelDraftKind = 'v13_grounded' | 'v13_thin' | 'v12_rss' | 'other';

export function getReelDraftRagChunkCount(draft: ReelDraftLike): number {
  const count = draft.generation_metadata?.rag_chunk_count;
  return typeof count === 'number' && Number.isFinite(count) ? count : 0;
}

export function classifyReelDraft(draft: ReelDraftLike): ReelDraftKind {
  const sourceType = draft.generation_metadata?.source_type;
  const isSak =
    sourceType === 'stortinget_sak' || Boolean(draft.stortinget_issue_id);
  if (isSak) {
    return getReelDraftRagChunkCount(draft) > 0 ? 'v13_grounded' : 'v13_thin';
  }
  if (sourceType === 'rss' || sourceType === 'regjeringen_rss') {
    return 'v12_rss';
  }
  return 'other';
}

/** Lower number = publish first (grounded v13 → thin v13 → v12 → other/v5). */
export function reelDraftPublishPriority(draft: ReelDraftLike): number {
  const kind = classifyReelDraft(draft);
  switch (kind) {
    case 'v13_grounded':
      return 0;
    case 'v13_thin':
      return 1;
    case 'v12_rss':
      return 2;
    case 'other':
      return 3;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function sortDraftsForPublishPriority<T extends ReelDraftLike>(drafts: T[]): T[] {
  return [...drafts].sort((a, b) => {
    const byKind = reelDraftPublishPriority(a) - reelDraftPublishPriority(b);
    if (byKind !== 0) return byKind;
    const ragDiff = getReelDraftRagChunkCount(b) - getReelDraftRagChunkCount(a);
    if (ragDiff !== 0) return ragDiff;
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
  });
}

export type ReelsLaunchReadiness = {
  activeCount: number;
  draftCount: number;
  groundedV13Drafts: number;
  v12Drafts: number;
  otherDrafts: number;
  pendingWithRag: number;
  sakCandidates: number;
  minActive: number;
  readyForPublic: boolean;
};

export function computeReelsLaunchReadiness(input: {
  activeCount: number;
  drafts: ReelDraftLike[];
  pendingWithRag?: number;
  sakCandidates?: number;
}): ReelsLaunchReadiness {
  let groundedV13Drafts = 0;
  let v12Drafts = 0;
  let otherDrafts = 0;

  for (const draft of input.drafts) {
    const kind = classifyReelDraft(draft);
    switch (kind) {
      case 'v13_grounded':
        groundedV13Drafts += 1;
        break;
      case 'v13_thin':
        otherDrafts += 1;
        break;
      case 'v12_rss':
        v12Drafts += 1;
        break;
      case 'other':
        otherDrafts += 1;
        break;
      default: {
        const _exhaustive: never = kind;
        void _exhaustive;
      }
    }
  }

  const activeCount = input.activeCount;
  return {
    activeCount,
    draftCount: input.drafts.length,
    groundedV13Drafts,
    v12Drafts,
    otherDrafts,
    pendingWithRag: input.pendingWithRag ?? 0,
    sakCandidates: input.sakCandidates ?? 0,
    minActive: REELS_PUBLIC_LAUNCH_MIN_ACTIVE,
    readyForPublic: activeCount >= REELS_PUBLIC_LAUNCH_MIN_ACTIVE,
  };
}
