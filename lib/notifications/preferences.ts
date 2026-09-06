import {
  DEFAULT_EMAIL_FREQUENCY_BY_CHANNEL,
  isNotificationChannel,
  isNotificationFrequency,
  type NotificationChannel,
  type NotificationFrequency,
} from '@/lib/notifications/channels';

const REMOVED_CHANNELS = new Set(['forum', 'mentions']);

export function normalizeEmailFrequencyByChannel(
  input: Record<string, unknown> | null | undefined,
): Record<NotificationChannel, NotificationFrequency> {
  const normalized = { ...DEFAULT_EMAIL_FREQUENCY_BY_CHANNEL };

  if (!input || typeof input !== 'object') {
    return normalized;
  }

  for (const [channel, frequency] of Object.entries(input)) {
    if (REMOVED_CHANNELS.has(channel)) continue;
    if (!isNotificationChannel(channel)) continue;
    const freq = String(frequency);
    if (!isNotificationFrequency(freq)) continue;
    normalized[channel] = freq;
  }

  return normalized;
}

export function pickDigestChannels(
  frequencies: Record<string, unknown>,
  digestFrequency: 'daily' | 'weekly',
): NotificationChannel[] {
  const normalized = normalizeEmailFrequencyByChannel(frequencies);
  return (Object.entries(normalized) as Array<[NotificationChannel, NotificationFrequency]>)
    .filter(([, frequency]) => frequency === digestFrequency)
    .map(([channel]) => channel);
}
