/**
 * Sort keys mirroring `n8n_claim_chunks_missing_v2` ORDER BY (see migration 26110300).
 * Tier 0 = hottest issues; tier 3 = referat / low-value. Document kind breaks ties
 * (innstilling → hoveddokument → other → referat last).
 */
export type ClaimSortKey = {
  lane: 'fast' | 'background';
  issueTier: number;
  documentKind: string;
  issueId: string;
  chunkIndex: number;
  chunkId: string;
};

export function documentKindSortRank(documentKind: string): number {
  const k = documentKind.toLowerCase();
  if (k.includes('innstilling')) return 0;
  if (k.includes('hoveddokument')) return 1;
  if (k.includes('referat')) return 9;
  return 5;
}

export function compareClaimSortKeys(a: ClaimSortKey, b: ClaimSortKey): number {
  if (a.lane === 'background' && b.lane === 'background' && a.issueTier !== b.issueTier) {
    return a.issueTier - b.issueTier;
  }

  const docDelta =
    documentKindSortRank(a.documentKind) - documentKindSortRank(b.documentKind);
  if (docDelta !== 0) return docDelta;

  const issueCmp = a.issueId.localeCompare(b.issueId);
  if (issueCmp !== 0) return issueCmp;

  if (a.chunkIndex !== b.chunkIndex) return a.chunkIndex - b.chunkIndex;
  return a.chunkId.localeCompare(b.chunkId);
}

export function sortClaimCandidates(keys: ClaimSortKey[]): ClaimSortKey[] {
  return [...keys].sort(compareClaimSortKeys);
}
