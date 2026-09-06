import type { NotificationChannel } from '@/lib/notifications/channels';

/** Payload for in-app + optional email delivery. */
export type CreateNotificationInput = {
  userId: string;
  type: string;
  channel: NotificationChannel;
  title: string;
  body?: string | null;
  url?: string | null;
  data?: Record<string, unknown>;
  origin?: string | null;
};

export type CreateNotificationSuccess = {
  ok: true;
  id: string;
  emailSent: boolean;
  emailSkippedReason?: 'disabled' | 'not_realtime' | 'smtp_not_configured' | 'no_email';
};

export type CreateNotificationFailure = {
  ok: false;
  error: string;
};

export type CreateNotificationResult = CreateNotificationSuccess | CreateNotificationFailure;

/**
 * Future admin compose hook — not wired to UI yet.
 * Service role callers can pass `delivery: 'in_app_only' | 'email_only' | 'both'`.
 */
export type AdminComposeNotificationInput = CreateNotificationInput & {
  delivery?: 'in_app_only' | 'email_only' | 'both';
  forceEmail?: boolean;
};
