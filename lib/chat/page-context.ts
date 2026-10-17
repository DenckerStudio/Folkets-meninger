/**
 * Structured page context for the Stemme+ chat. The client sends which page the
 * chat was opened from (page type plus ids) in the request body; the server
 * validates it and adds a short context line to the instructions so the model
 * can call the right tool with the right id. Ids never appear in the visible
 * suggestion text or in the user's message.
 */
import type { ChatViewKind, ChatViewRef } from '@/lib/chat/view-context';

export type ChatPageContext = {
  kind: ChatViewKind;
  sakId: string | null;
  personId: string | null;
  pollId: string | null;
  hoeringId: string | null;
  opinionId: string | null;
};

const KINDS: readonly ChatViewKind[] = [
  'sak',
  'mening',
  'politiker',
  'reel',
  'horing',
  'utforsk',
  'folkets-meninger',
  'horinger',
  'general',
];

/** Ids are injected into the instructions, so only plain id characters pass. */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;

export function cleanContextId(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const trimmed = String(value).trim();
  return ID_PATTERN.test(trimmed) ? trimmed : null;
}

/** Page context for a resolved view (client side). */
export function pageContextFromView(view: ChatViewRef, sakId: string | null | undefined): ChatPageContext {
  const id = cleanContextId(view.id);
  return {
    kind: view.kind,
    sakId: cleanContextId(sakId) ?? (view.kind === 'sak' ? id : null),
    personId: view.kind === 'politiker' ? id : null,
    pollId: view.kind === 'reel' ? id : null,
    hoeringId: view.kind === 'horing' ? id : null,
    opinionId: view.kind === 'mening' ? id : null,
  };
}

/** Validate an untrusted `pageContext` from the request body. */
export function parseChatPageContext(raw: unknown): ChatPageContext | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const kind =
    typeof row.kind === 'string' && KINDS.includes(row.kind as ChatViewKind)
      ? (row.kind as ChatViewKind)
      : 'general';
  const context: ChatPageContext = {
    kind,
    sakId: cleanContextId(row.sakId),
    personId: kind === 'politiker' ? cleanContextId(row.personId) : null,
    pollId: kind === 'reel' ? cleanContextId(row.pollId) : null,
    hoeringId: kind === 'horing' ? cleanContextId(row.hoeringId) : null,
    opinionId: kind === 'mening' ? cleanContextId(row.opinionId) : null,
  };
  const hasAny =
    context.sakId || context.personId || context.pollId || context.hoeringId || context.opinionId;
  return hasAny ? context : null;
}

/**
 * Instruction lines describing the page. The open sak itself is covered by the
 * sak hint in the instructions; here it is only mentioned when the page is about
 * something tied to a sak (a hearing, poll or opinion).
 */
export function describeChatPageContext(context: ChatPageContext | null | undefined): string[] {
  if (!context) return [];
  const lines: string[] = [];
  const sak = context.sakId;
  switch (context.kind) {
    case 'politiker':
      if (context.personId) {
        lines.push(
          `Brukeren ser på politikersiden for person-id ${context.personId}. Når brukeren skriver «hen», «representanten» eller navnet, slå opp med getPolitician (personId ${context.personId}).`,
        );
      }
      break;
    case 'reel':
      if (context.pollId) {
        lines.push(
          `Brukeren ser på avstemningen ${context.pollId} i appen. Hent resultatet med getPollResults (pollId ${context.pollId}).${sak ? ` Avstemningen gjelder sak ${sak}.` : ''}`,
        );
      }
      break;
    case 'horing':
      if (context.hoeringId) {
        lines.push(
          `Brukeren ser på høringen ${context.hoeringId}.${sak ? ` Den hører til sak ${sak}: bruk findHearingsForSak (issueId ${sak}) for frist og innspill, og retrieveSakContext for innholdet.` : ' Finn den med listOpenHearings.'}`,
        );
      }
      break;
    case 'mening':
      if (context.opinionId) {
        lines.push(
          `Brukeren ser på en innsendt mening (id ${context.opinionId}). Meningen er brukerinnhold, ikke en kilde.${sak ? ` Den er knyttet til sak ${sak}.` : ''}`,
        );
      }
      break;
    default:
      if (sak && context.kind !== 'sak') {
        lines.push(`Spørsmålet gjelder sak ${sak}.`);
      }
      break;
  }
  if (lines.length > 0) {
    lines.push('Ikke vis id-ene til brukeren; bruk navn og titler i svaret.');
  }
  return lines;
}
