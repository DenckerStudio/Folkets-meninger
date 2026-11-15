import {
  USER_ANNOTATION_TARGET_TYPES,
  type CreateUserAnnotationInput,
  type UpdateUserAnnotationInput,
  type UserAnnotationTargetType,
} from '@/lib/user-annotations/types';

const MAX_QUOTE = 2000;
const MAX_NOTE = 4000;
const MAX_CONTAINER_KEY = 120;
const MAX_TARGET_ID = 128;
const MAX_ANCHOR = 80;

export function isUserAnnotationTargetType(value: unknown): value is UserAnnotationTargetType {
  return (
    typeof value === 'string' &&
    (USER_ANNOTATION_TARGET_TYPES as readonly string[]).includes(value)
  );
}

function nonemptyTrimmed(value: unknown, maxLen: number, field: string): string | { error: string } {
  if (typeof value !== 'string') {
    return { error: `${field} må være tekst` };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { error: `${field} kan ikke være tom` };
  }
  if (trimmed.length > maxLen) {
    return { error: `${field} er for lang` };
  }
  return trimmed;
}

function optionalNote(value: unknown): string | null | { error: string } {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    return { error: 'note må være tekst' };
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_NOTE) {
    return { error: 'Notatet er for langt' };
  }
  return trimmed.length === 0 ? null : trimmed;
}

function optionalAnchor(value: unknown): string | null | { error: string } {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    return { error: 'anker må være tekst' };
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_ANCHOR) {
    return trimmed.slice(-MAX_ANCHOR);
  }
  return trimmed;
}

export function parseCreateUserAnnotationBody(
  body: unknown,
): { ok: true; value: CreateUserAnnotationInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Ugyldig forespørsel' };
  }
  const raw = body as Record<string, unknown>;

  if (!isUserAnnotationTargetType(raw.target_type)) {
    return { ok: false, error: 'Ugyldig måltype' };
  }

  const targetId = nonemptyTrimmed(raw.target_id, MAX_TARGET_ID, 'target_id');
  if (typeof targetId === 'object') return { ok: false, error: targetId.error };

  const containerKey = nonemptyTrimmed(raw.container_key, MAX_CONTAINER_KEY, 'container_key');
  if (typeof containerKey === 'object') return { ok: false, error: containerKey.error };

  const quote = nonemptyTrimmed(raw.quote, MAX_QUOTE, 'quote');
  if (typeof quote === 'object') return { ok: false, error: quote.error };

  const note = optionalNote(raw.note);
  if (note !== null && typeof note === 'object') return { ok: false, error: note.error };

  const anchorPrefix = optionalAnchor(raw.anchor_prefix);
  if (anchorPrefix !== null && typeof anchorPrefix === 'object') {
    return { ok: false, error: anchorPrefix.error };
  }

  const anchorSuffix = optionalAnchor(raw.anchor_suffix);
  if (anchorSuffix !== null && typeof anchorSuffix === 'object') {
    return { ok: false, error: anchorSuffix.error };
  }

  const startOffset = raw.start_offset;
  const endOffset = raw.end_offset;
  if (typeof startOffset !== 'number' || !Number.isInteger(startOffset) || startOffset < 0) {
    return { ok: false, error: 'Ugyldig startposisjon' };
  }
  if (typeof endOffset !== 'number' || !Number.isInteger(endOffset) || endOffset <= startOffset) {
    return { ok: false, error: 'Ugyldig sluttposisjon' };
  }
  if (endOffset - startOffset > MAX_QUOTE) {
    return { ok: false, error: 'Markeringen er for lang' };
  }

  const sliceLen = endOffset - startOffset;
  if (quote.length !== sliceLen && quote.length > sliceLen) {
    return { ok: false, error: 'Markert tekst stemmer ikke med posisjonene' };
  }

  return {
    ok: true,
    value: {
      target_type: raw.target_type,
      target_id: targetId,
      container_key: containerKey,
      quote,
      note,
      start_offset: startOffset,
      end_offset: endOffset,
      anchor_prefix: anchorPrefix,
      anchor_suffix: anchorSuffix,
    },
  };
}

export function parseUpdateUserAnnotationBody(
  body: unknown,
): { ok: true; value: UpdateUserAnnotationInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Ugyldig forespørsel' };
  }
  const raw = body as Record<string, unknown>;
  if (!('note' in raw)) {
    return { ok: false, error: 'Ingenting å oppdatere' };
  }
  const note = optionalNote(raw.note);
  if (note !== null && typeof note === 'object') return { ok: false, error: note.error };
  return { ok: true, value: { note } };
}

export function rowToPublic(row: {
  id: string;
  user_id: string;
  target_type: UserAnnotationTargetType;
  target_id: string;
  container_key: string;
  quote: string;
  note: string | null;
  start_offset: number;
  end_offset: number;
  anchor_prefix: string | null;
  anchor_suffix: string | null;
  created_at: string;
  updated_at: string;
}): Omit<typeof row, 'user_id'> {
  const { user_id: _userId, ...rest } = row;
  return rest;
}