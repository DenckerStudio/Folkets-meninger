import type { PollGenerationMetadata, PollRecord } from '@/lib/polls/types';

/** Temporary n8n marker prefix until the admin badge is live (case-sensitive). */
export const UTEN_KONTEKST_MARKER_PREFIX = '[UTEN KONTEKST';

export const UTEN_KONTEKST_BADGE_HINT =
  'Laget uten kildetreff – sjekk fakta før publisering.';

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

export type StripUtenKontekstMarkerResult =
  | { kind: 'unchanged' }
  | { kind: 'stripped'; text: string }
  | { kind: 'unclosed_prefix' };

/**
 * Removes a leading `[UTEN KONTEKST …]` block (through the first `]`) and whitespace after it.
 * Leading whitespace on the original string is preserved when possible.
 */
export function stripUtenKontekstMarkerFromText(text: string): StripUtenKontekstMarkerResult {
  const leadingMatch = text.match(/^(\s*)/);
  const leading = leadingMatch?.[1] ?? '';
  const trimmedStart = text.slice(leading.length);

  if (!trimmedStart.startsWith(UTEN_KONTEKST_MARKER_PREFIX)) {
    return { kind: 'unchanged' };
  }

  const closeIdx = trimmedStart.indexOf(']');
  if (closeIdx === -1) {
    return { kind: 'unclosed_prefix' };
  }

  const remainder = trimmedStart.slice(closeIdx + 1).replace(/^\s+/, '');
  return { kind: 'stripped', text: leading + remainder };
}

function utenKontekstFieldsLabel(title: boolean, summary: boolean): string {
  if (title && summary) return 'Tittelen og sammendraget';
  if (title) return 'Tittelen';
  if (summary) return 'Sammendraget';
  return '';
}

/** Amber notice shown before publish when a well-formed prefix is still present. */
export function getUtenKontekstPrefixNoticeMessage(poll: PollPublicTextFields): string | null {
  const titleHas = textHasUtenKontekstMarkerPrefix(poll.title);
  const summaryHas = textHasUtenKontekstMarkerPrefix(poll.neutralSummary);
  if (!titleHas && !summaryHas) return null;
  const subject = utenKontekstFieldsLabel(titleHas, summaryHas);
  return `${subject} har merknaden «[UTEN KONTEKST …]». Den fjernes når du publiserer – sjekk fakta først.`;
}

/** Publish is blocked only when the prefix has no closing `]`. */
export function getUnclosedUtenKontekstPrefixPublishError(
  poll: PollPublicTextFields,
): string | null {
  const titleUnclosed = stripUtenKontekstMarkerFromText(poll.title).kind === 'unclosed_prefix';
  const summaryUnclosed =
    stripUtenKontekstMarkerFromText(poll.neutralSummary).kind === 'unclosed_prefix';
  if (!titleUnclosed && !summaryUnclosed) return null;
  const subject = utenKontekstFieldsLabel(titleUnclosed, summaryUnclosed);
  return `${subject} har en ufullstendig «[UTEN KONTEKST …]»-merknad og kan ikke publiseres.`;
}

export type PreparePollForPublishResult =
  | { title: string; neutralSummary: string; textChanged: boolean }
  | { error: string };

/** Strips well-formed prefixes; returns an error when a prefix cannot be closed. */
export function preparePollPublicTextForPublish(
  poll: PollPublicTextFields,
): PreparePollForPublishResult {
  const blocked = getUnclosedUtenKontekstPrefixPublishError(poll);
  if (blocked) return { error: blocked };

  let title = poll.title;
  let neutralSummary = poll.neutralSummary;
  let textChanged = false;

  const titleStrip = stripUtenKontekstMarkerFromText(poll.title);
  if (titleStrip.kind === 'stripped') {
    title = titleStrip.text;
    textChanged = true;
  }

  const summaryStrip = stripUtenKontekstMarkerFromText(poll.neutralSummary);
  if (summaryStrip.kind === 'stripped') {
    neutralSummary = summaryStrip.text;
    textChanged = true;
  }

  return { title, neutralSummary, textChanged };
}
