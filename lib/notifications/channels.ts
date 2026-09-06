export const NOTIFICATION_CHANNELS = ['categories', 'labels'] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_FREQUENCIES = ['realtime', 'daily', 'weekly'] as const;

export type NotificationFrequency = (typeof NOTIFICATION_FREQUENCIES)[number];

export type DigestFrequency = 'daily' | 'weekly';

export const DEFAULT_EMAIL_FREQUENCY_BY_CHANNEL: Record<NotificationChannel, NotificationFrequency> = {
  categories: 'daily',
  labels: 'daily',
};

export const CHANNEL_UI_COPY: Record<
  NotificationChannel,
  { label: string; description: string }
> = {
  categories: {
    label: 'Hjertesaker (komitéområder)',
    description:
      'E-post når nye Stortinget-saker dukker opp i komitéområdene du følger under Mine hjertesaker.',
  },
  labels: {
    label: 'AI-emner',
    description:
      'E-post når nye saker får AI-emneord du abonnerer på under Mine hjertesaker.',
  },
};

export function isNotificationChannel(value: string): value is NotificationChannel {
  return (NOTIFICATION_CHANNELS as readonly string[]).includes(value);
}

export function isNotificationFrequency(value: string): value is NotificationFrequency {
  return (NOTIFICATION_FREQUENCIES as readonly string[]).includes(value);
}

export function isDigestFrequency(value: string): value is DigestFrequency {
  return value === 'daily' || value === 'weekly';
}
