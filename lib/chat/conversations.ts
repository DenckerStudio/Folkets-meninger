/**
 * Browser-local saved conversations for the Stemme+ chat. Stored in localStorage only —
 * never sent to the server — so transcripts stay on the user's own device. Mirrors the
 * app's existing "ephemeral in the browser" posture, but survives reloads.
 */

export type StoredMessage = {
  id: string;
  role: string;
  parts: unknown[];
};

export type StoredConversation = {
  id: string;
  title: string;
  updatedAt: number;
  issueId: string | null;
  messages: StoredMessage[];
};

export const CONVERSATIONS_STORAGE_KEY = 'folkets:chat:conversations';
export const MAX_CONVERSATIONS = 20;
export const MAX_MESSAGES_PER_CONVERSATION = 100;

function hasWindow(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeConversation(raw: unknown): StoredConversation | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === 'string' ? raw.id : null;
  if (!id) return null;
  const messages = Array.isArray(raw.messages)
    ? raw.messages
        .map((m): StoredMessage | null => {
          if (!isRecord(m)) return null;
          const mid = typeof m.id === 'string' ? m.id : null;
          const role = typeof m.role === 'string' ? m.role : null;
          if (!mid || !role || !Array.isArray(m.parts)) return null;
          return { id: mid, role, parts: m.parts };
        })
        .filter((m): m is StoredMessage => m !== null)
    : [];
  return {
    id,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'Ny samtale',
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
    issueId: typeof raw.issueId === 'string' && raw.issueId ? raw.issueId : null,
    messages,
  };
}

/** First user message becomes the conversation title (truncated). */
export function titleFromMessages(messages: StoredMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  const text = extractText(firstUser?.parts) || 'Ny samtale';
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

export function extractText(parts: unknown): string {
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) => (isRecord(p) && p.type === 'text' && typeof p.text === 'string' ? p.text : ''))
    .join(' ')
    .trim();
}

export function loadConversations(): StoredConversation[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeConversation)
      .filter((c): c is StoredConversation => c !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_CONVERSATIONS);
  } catch {
    return [];
  }
}

function persist(conversations: StoredConversation[]): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(
      CONVERSATIONS_STORAGE_KEY,
      JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS)),
    );
  } catch {
    // Quota or privacy mode — keep the in-memory session working.
  }
}

/** Insert or update a conversation, newest first, capped for storage safety. */
export function saveConversation(conversation: StoredConversation): StoredConversation[] {
  const trimmed: StoredConversation = {
    ...conversation,
    title: conversation.title.trim() || titleFromMessages(conversation.messages),
    messages: conversation.messages.slice(-MAX_MESSAGES_PER_CONVERSATION),
  };
  const existing = loadConversations().filter((c) => c.id !== trimmed.id);
  const next = [trimmed, ...existing].sort((a, b) => b.updatedAt - a.updatedAt);
  persist(next);
  return next;
}

export function deleteConversation(id: string): StoredConversation[] {
  const next = loadConversations().filter((c) => c.id !== id);
  persist(next);
  return next;
}

export function newConversationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function toStoredMessages(
  messages: Array<{ id: string; role: string; parts: unknown[] }>,
): StoredMessage[] {
  return messages.map((m) => ({ id: m.id, role: m.role, parts: m.parts }));
}
