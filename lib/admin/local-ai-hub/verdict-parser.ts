export type ReviewVerdictReviewer = 'pixel' | 'friction';

export type ReviewVerdictOutcome = 'pass' | 'fail' | 'unknown';

export type ParsedReviewVerdict = {
  reviewer: ReviewVerdictReviewer;
  outcome: ReviewVerdictOutcome;
  sha: string | null;
  createdAt: string | null;
};

const PIXEL_PASS =
  /\*{0,2}\s*Pixel\s+UI\s*:?\s*PASS\s*@\*{0,2}\s*[`']?([0-9a-f]{7,40})[`']?\s*\*{0,2}/i;
const PIXEL_FAIL =
  /\*{0,2}\s*Pixel\s+UI\s*:?\s*FAIL\s*@\*{0,2}\s*[`']?([0-9a-f]{7,40})[`']?\s*\*{0,2}/i;
const FRICTION_PASS =
  /\*{0,2}\s*Friction\s+UX\s*:?\s*PASS\s*@\*{0,2}\s*[`']?([0-9a-f]{7,40})[`']?\s*\*{0,2}/i;
const FRICTION_FAIL =
  /\*{0,2}\s*Friction\s+UX\s*:?\s*FAIL\s*@\*{0,2}\s*[`']?([0-9a-f]{7,40})[`']?\s*\*{0,2}/i;

type CommentLike = { body: string; created_at?: string | null };

function extractVerdict(
  body: string,
  passRe: RegExp,
  failRe: RegExp,
): { outcome: 'pass' | 'fail'; sha: string } | null {
  const fail = failRe.exec(body);
  if (fail?.[1]) {
    return { outcome: 'fail', sha: fail[1].toLowerCase() };
  }
  const pass = passRe.exec(body);
  if (pass?.[1]) {
    return { outcome: 'pass', sha: pass[1].toLowerCase() };
  }
  return null;
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
  comments: CommentLike[],
  headSha: string,
): { pixel: ReviewVerdictOutcome; friction: ReviewVerdictOutcome } {
  const sorted = [...comments].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return tb - ta;
  });

  const resolveNewest = (
    passRe: RegExp,
    failRe: RegExp,
  ): ReviewVerdictOutcome => {
    for (const c of sorted) {
      const hit = extractVerdict(c.body ?? '', passRe, failRe);
      if (!hit) continue;
      if (shaMatchesHead(hit.sha, headSha)) {
        return hit.outcome;
      }
      return 'unknown';
    }
    return 'unknown';
  };

  return {
    pixel: resolveNewest(PIXEL_PASS, PIXEL_FAIL),
    friction: resolveNewest(FRICTION_PASS, FRICTION_FAIL),
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