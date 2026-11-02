/** Case-insensitive, trimmed match for destructive admin confirms. */
export function adminEmailsMatchForConfirm(typed: string, expected: string): boolean {
  const a = typed.trim().toLowerCase();
  const b = expected.trim().toLowerCase();
  return a.length > 0 && b.length > 0 && a === b;
}
