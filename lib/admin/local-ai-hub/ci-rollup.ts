export type CiCheckItem = {
  name: string;
  status: string;
  conclusion: string | null;
};

export type CiRollup = {
  state: 'success' | 'pending' | 'failure' | 'unknown';
  checks: CiCheckItem[];
  summary: string;
};

const FAILURE_CONCLUSIONS = new Set(['failure', 'cancelled', 'timed_out', 'action_required']);
const PENDING_STATUSES = new Set(['queued', 'in_progress', 'pending', 'waiting']);

function normalizeConclusion(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.toLowerCase();
}

export function rollupCi(input: {
  checkRuns: { name: string; status: string; conclusion: string | null }[];
  statuses: { context: string; state: string }[];
}): CiRollup {
  const checks: CiCheckItem[] = [];

  for (const cr of input.checkRuns) {
    checks.push({
      name: cr.name,
      status: cr.status,
      conclusion: normalizeConclusion(cr.conclusion),
    });
  }
  for (const st of input.statuses) {
    checks.push({
      name: st.context,
      status: st.state,
      conclusion: st.state === 'success' ? 'success' : st.state,
    });
  }

  if (checks.length === 0) {
    return { state: 'unknown', checks, summary: 'Ingen CI-status funnet' };
  }

  let hasPending = false;
  let hasFailure = false;

  for (const c of checks) {
    const status = c.status.toLowerCase();
    const conclusion = c.conclusion?.toLowerCase() ?? null;
    if (PENDING_STATUSES.has(status) || status === 'pending' || conclusion === 'pending') {
      hasPending = true;
    }
    if (conclusion && FAILURE_CONCLUSIONS.has(conclusion)) {
      hasFailure = true;
    }
    if (status === 'failure' || status === 'error') {
      hasFailure = true;
    }
    if (conclusion === 'failure' || conclusion === 'error') {
      hasFailure = true;
    }
  }

  if (hasFailure) {
    return { state: 'failure', checks, summary: 'Minst én CI-sjekk feilet' };
  }
  if (hasPending) {
    return { state: 'pending', checks, summary: 'CI kjører fortsatt' };
  }

  const allSuccess = checks.every((c) => {
    const status = c.status.toLowerCase();
    const conclusion = c.conclusion?.toLowerCase();
    if (conclusion === 'success' || conclusion === 'skipped' || conclusion === 'neutral') return true;
    if (status === 'success') return true;
    return false;
  });

  if (allSuccess) {
    return { state: 'success', checks, summary: 'Alle CI-sjekker er grønne' };
  }

  return { state: 'unknown', checks, summary: 'CI-status er uklar' };
}

export function ciBlocksMerge(rollup: CiRollup): boolean {
  return rollup.state !== 'success';
}