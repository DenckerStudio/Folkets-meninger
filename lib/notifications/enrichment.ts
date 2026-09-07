import type { NotificationChannel } from '@/lib/notifications/channels';
import { CHANNEL_UI_COPY } from '@/lib/notifications/channels';
import {
  digestIncludesBody,
  digestIncludesChannelGroups,
  digestItemLimit,
} from '@/lib/stemme-plus/gates';
import { isStemmePlusActive, type UserSubscriptionRow } from '@/lib/stemme-plus/tier';

export type DigestNotificationRow = {
  title: string;
  body?: string | null;
  url?: string | null;
  createdAt: string;
  channel?: NotificationChannel | string | null;
};

export type PreparedDigest = {
  items: DigestNotificationRow[];
  isTeaser: boolean;
  maxItems: number;
  groupedByChannel: Array<{ channel: NotificationChannel; label: string; items: DigestNotificationRow[] }>;
};

export function prepareDigestForUser(
  items: DigestNotificationRow[],
  subscription: UserSubscriptionRow | null | undefined,
): PreparedDigest {
  const maxItems = digestItemLimit(subscription);
  const sorted = [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const limited = sorted.slice(0, maxItems);
  const isTeaser = !isStemmePlusActive(subscription);

  if (!digestIncludesChannelGroups(subscription)) {
    return {
      items: limited.map((item) => ({
        title: item.title,
        url: item.url,
        createdAt: item.createdAt,
        body: digestIncludesBody(subscription) ? item.body : null,
        channel: item.channel,
      })),
      isTeaser,
      maxItems,
      groupedByChannel: [],
    };
  }

  const byChannel = new Map<NotificationChannel, DigestNotificationRow[]>();
  for (const item of limited) {
    const channel = (item.channel === 'labels' ? 'labels' : 'categories') as NotificationChannel;
    const list = byChannel.get(channel) ?? [];
    list.push({
      title: item.title,
      body: digestIncludesBody(subscription) ? item.body : null,
      url: item.url,
      createdAt: item.createdAt,
      channel,
    });
    byChannel.set(channel, list);
  }

  const groupedByChannel = (['categories', 'labels'] as NotificationChannel[])
    .filter((channel) => byChannel.has(channel))
    .map((channel) => ({
      channel,
      label: CHANNEL_UI_COPY[channel].label,
      items: byChannel.get(channel) ?? [],
    }));

  return {
    items: limited,
    isTeaser,
    maxItems,
    groupedByChannel,
  };
}

export function buildCategoryAlertBody(
  issue: { title: string; category: string; status?: string | null },
  isPlus: boolean,
): string {
  if (!isPlus) {
    return issue.title;
  }

  const statusPart = issue.status ? ` · Status: ${issue.status}` : '';
  return `${issue.title}\nKomitéområde: ${issue.category}${statusPart}`;
}

export function buildLabelAlertBody(
  issueTitle: string,
  matchedLabels: string[],
  isPlus: boolean,
): string {
  if (!isPlus) {
    return issueTitle;
  }

  const labelList = matchedLabels.length > 0 ? matchedLabels.join(', ') : '—';
  return `${issueTitle}\nMatcher dine emner: ${labelList}`;
}
