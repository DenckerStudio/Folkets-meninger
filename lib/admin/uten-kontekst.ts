import type { PollGenerationMetadata, PollRecord } from '@/lib/polls/types';

/** Temporary n8n marker prefix until the admin badge is live (case-sensitive). */
export const UTEN_KONTEKST_MARKER_PREFIX = '[UTEN KONTEKST';

export const UTEN_KONTEKST_PUBLISH_BLOCKED_MESSAGE =
  'Fjern «[UTEN KONTEKST …]» fra sammendraget før publisering';

export function isPollDraftUtenKontekst(
  metadata: PollGenerationMetadata | null | undefined,
): boolean {
  return metadata?.uten_kontekst === true;
}

export function textHasUtenKontekstMarkerPrefix(text: string | null | undefined): boolean {
  if (text == null || text === '') return false;
  return text.trimStart().startsWith(UTEN_KONTEKST_MARKER_PREFIX);
}

export type PollPublicTextFields = Pick<PollRecord, 'title' | 'neutralSummary'>;

export function pollHasUtenKontekstMarkerInPublicText(poll: PollPublicTextFields): boolean {
  return (
    textHasUtenKontekstMarkerPrefix(poll.title) ||
    textHasUtenKontekstMarkerPrefix(poll.neutralSummary)
  );
}

/** Returns a Norwegian error message when publish must be blocked, otherwise null. */
export function getPublishBlockedUtenKontekstMessage(
  poll: PollPublicTextFields,
): string | null {
  if (!pollHasUtenKontekstMarkerInPublicText(poll)) return null;
  return UTEN_KONTEKST_PUBLISH_BLOCKED_MESSAGE;
}
