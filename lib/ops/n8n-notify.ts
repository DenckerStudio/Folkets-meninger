export type N8nNotifyKind = 'error' | 'health';

export type N8nNotifyPayload = {
  kind: N8nNotifyKind;
  subject: string;
  text: string;
  meta: Record<string, unknown>;
};

const MAX_TEXT = 8000;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asKind(value: unknown): N8nNotifyKind {
  return value === 'health' ? 'health' : 'error';
}

export function parseN8nNotifyPayload(input: unknown): N8nNotifyPayload | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const subject = typeof raw.subject === 'string' ? raw.subject.trim() : '';
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (!subject || !text) return null;
  return {
    kind: asKind(raw.kind),
    subject: subject.slice(0, 200),
    text: text.slice(0, MAX_TEXT),
    meta: asRecord(raw.meta),
  };
}

export function opsAlertRecipient(): string {
  return (
    process.env.OPS_ALERT_EMAIL?.trim() ||
    process.env.FEEDBACK_INBOX_EMAIL?.trim() ||
    'kontakt@folketsstemme.no'
  );
}
