export const POLL_ALREADY_EXISTS_MESSAGE = 'Poll already exists for issue';

export function normalizePollIssueId(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

export function isPollAlreadyExistsError(error: unknown): boolean {
  const parts: string[] = [];
  if (typeof error === 'string') {
    parts.push(error);
  }
  if (error instanceof Error) {
    parts.push(error.message);
  }
  if (error && typeof error === 'object') {
    const row = error as Record<string, unknown>;
    for (const key of ['message', 'details', 'hint', 'description']) {
      if (typeof row[key] === 'string') parts.push(row[key]);
    }
  }
  return parts.some((part) => part.toLowerCase().includes(POLL_ALREADY_EXISTS_MESSAGE.toLowerCase()));
}
