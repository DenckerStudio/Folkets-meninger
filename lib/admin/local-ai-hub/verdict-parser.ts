export type ReviewVerdictReviewer = 'pixel' | 'friction';

export type ReviewVerdictOutcome = 'pass' | 'fail' | 'unknown';

export type ParsedReviewVerdict = {
  reviewer: ReviewVerdictReviewer;
  outcome: ReviewVerdictOutcome;
  sha: string | null;
  createdAt: string | null;
};

export const TRUSTED_VERDICT_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

/** Pixel: «Pixel UI PASS», «Pixel: UI PASS», valgfri ** før @ */
const PIXEL_VERDICT_RE =
  /(?:\*{1,2}\s*)?Pixel(?:\s*:\s*UI|\s+UI)?\s*:?\s*(PASS|FAIL)[\s*]*@\*{0,2}\s*[`'"]?([0-9a-f]{7,40})/gi;

/** Friction: «Friction UX: PASS», «Friction FAIL» (UX valgfritt i korte varianter) */
const FRICTION_VERDICT_RE =
  /(?:\*{1,2}\s*)?Friction(?:\s+UX)?\s*:?\s*(PASS|FAIL)[\s*]*@\*{0,2}\s*[`'"]?([0-9a-f]{7,40})/gi;

export type VerdictCommentLike = {
  body: string;
  created_at?: string | null;
  author_association?: string | null;
};

export function isTrustedVerdictComment(authorAssociation: string | null | undefined): boolean {
  if (!authorAssociation) return false;
  return TRUSTED_VERDICT_ASSOCIATIONS.has(authorAssociation.toUpperCase());
}

function firstVerdictInBody(
  body: string,
  verdictRe: RegExp,
): { outcome: 'pass' | 'fail'; sha: string } | null {
  let earliestIndex = Number.POSITIVE_INFINITY;
  let result: { outcome: 'pass' | 'fail'; sha: string } | null = null;
  const re = new RegExp(verdictRe.source, verdictRe.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const outcomeRaw = match[1]?.toUpperCase();
    const sha = match[2]?.toLowerCase();
    if (!sha || (outcomeRaw !== 'PASS' && outcomeRaw !== 'FAIL') || match.index === undefined) {
      continue;
    }
    const outcome = outcomeRaw === 'PASS' ? 'pass' : 'fail';
    if (match.index < earliestIndex) {
      earliestIndex = match.index;
      result = { outcome, sha };
    }
  }
  return result;
}

export function shaMatchesHead(commentSha: string, headSha: string): boolean {
  const head = headSha.toLowerCase();
  const c = commentSha.toLowerCase();
  if (c.length < 7) return false;
  if (c.length >= head.length) {
    return head === c || head.startsWith(c);
  }
  return head.startsWith(c);
}

export function parseVerdictsFromComments(
  comments: VerdictCommentLike[],
  headSha: string,
): { pixel: ReviewVerdictOutcome; friction: ReviewVerdictOutcome } {
  const trusted = comments.filter((c) => isTrustedVerdictComment(c.author_association));
  const sorted = [...trusted].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return tb - ta;
  });

  const resolveNewest = (verdictRe: RegExp): ReviewVerdictOutcome => {
    for (const c of sorted) {
      const hit = firstVerdictInBody(c.body ?? '', verdictRe);
      if (!hit) continue;
      if (shaMatchesHead(hit.sha, headSha)) {
        return hit.outcome;
      }
      return 'unknown';
    }
    return 'unknown';
  };

  return {
    pixel: resolveNewest(PIXEL_VERDICT_RE),
    friction: resolveNewest(FRICTION_VERDICT_RE),
  };
}

export function verdictLabel(outcome: ReviewVerdictOutcome): string {
  switch (outcome) {
    case 'pass':
      return 'Godkjent';
    case 'fail':
      return 'Avvist';
    case 'unknown':
      return 'Mangler';
    default: {
      const _exhaustive: never = outcome;
      return _exhaustive;
    }
  }
}