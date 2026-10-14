/**
 * Detection + typed error for the B6 schema introduced by migration
 * `20261014120000_opinion_reel_drafts.sql` (polls.source_opinion_id +
 * create_poll_draft_from_opinion). When that migration is missing we hide the
 * "Reels fra meninger" feature instead of surfacing raw DB errors.
 */

type MaybePostgrestError = { code?: string | null; message?: string | null } | null | undefined;

const MISSING_SCHEMA_CODES = new Set([
  '42703', // undefined_column
  '42P01', // undefined_table
  '42883', // undefined_function
  'PGRST202', // function not found in schema cache
  'PGRST204', // column not found in schema cache
  'PGRST205', // table not found in schema cache
]);

export function isMissingReelDraftSchema(error: MaybePostgrestError): boolean {
  if (!error) return false;

  const code = (error.code ?? '').trim();
  if (code && MISSING_SCHEMA_CODES.has(code)) return true;

  const message = (error.message ?? '').toLowerCase();
  return (
    message.includes('could not find the function') ||
    message.includes('schema cache') ||
    (message.includes('column') &&
      message.includes('source_opinion_id') &&
      message.includes('does not exist'))
  );
}

/** Thrown when the B6 migration is not applied. Callers map it to a 503. */
export class OpinionReelDraftUnavailableError extends Error {
  constructor() {
    super('Reel-utkast fra meninger er ikke tilgjengelig (migrasjonen mangler)');
    this.name = 'OpinionReelDraftUnavailableError';
  }
}
