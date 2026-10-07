import type { NotificationItem, NotificationKind } from '@/components/ui/notification-panel';

export type ApiNotification = {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  created_at: string;
  read_at: string | null;
  channel: string;
  type: string;
};

function kindFor(channel: string, type: string): NotificationKind {
  if (channel === 'labels') return 'mention';
  if (channel === 'categories') return 'created';
  if (type.includes('welcome')) return 'join';
  if (type.includes('due') || type.includes('deadline')) return 'due';
  if (type.includes('comment')) return 'comment';
  if (type.includes('file') || type.includes('document')) return 'file';
  return 'created';
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'nå';
  if (mins < 60) return `${mins} min siden`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} t siden`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d siden`;
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

export function mapApiNotification(
  n: ApiNotification,
  archivedIds: Set<string>,
): NotificationItem {
  const bodyPieces: NotificationItem['body'] = [];
  if (n.body) {
    bodyPieces.push(` ${n.body}`);
  } else {
    bodyPieces.push(' nytt varsel');
  }

  const channelLabel =
    n.channel === 'labels' ? 'Emner' : n.channel === 'categories' ? 'Hjertesaker' : n.channel;

  return {
    id: n.id,
    actor: { name: n.title || 'Folkets Stemme' },
    kind: kindFor(n.channel, n.type),
    body: bodyPieces,
    time: relativeTime(n.created_at),
    createdAt: n.created_at,
    channel: n.channel || 'other',
    context: channelLabel ? [channelLabel] : undefined,
    unread: !n.read_at,
    archived: archivedIds.has(n.id),
    href: n.url || undefined,
  };
}
