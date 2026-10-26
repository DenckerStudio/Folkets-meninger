const ISSUE_ID_PATTERN = /^\d{1,12}$/;

export type ParseResetAiSummaryQueueBodyResult =
  | { ok: true; issueId: string }
  | { ok: false; status: number; error: string };

export function parseResetAiSummaryQueueBody(
  raw: unknown,
): ParseResetAiSummaryQueueBodyResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, status: 400, error: 'Ugyldig JSON' };
  }
  const issueIdRaw = (raw as Record<string, unknown>).issue_id;
  if (typeof issueIdRaw !== 'string') {
    return { ok: false, status: 400, error: 'issue_id mangler' };
  }
  const issueId = issueIdRaw.trim();
  if (!ISSUE_ID_PATTERN.test(issueId)) {
    return { ok: false, status: 400, error: 'Ugyldig issue_id' };
  }
  return { ok: true, issueId };
}

export { ISSUE_ID_PATTERN };
