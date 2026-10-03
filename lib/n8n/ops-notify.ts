import { listAppAdmins } from '@/lib/admin/roles';
import { sendOpsNotificationEmail } from '@/lib/email/nodemailer';
import { isSmtpConfigured } from '@/lib/email/smtp-config';
import { getServiceSupabase } from '@/lib/supabase';

export const OPS_NOTIFY_KINDS = ['error', 'hearing', 'health', 'info'] as const;

export type OpsNotifyKind = (typeof OPS_NOTIFY_KINDS)[number];

export type OpsNotifyPayload = {
  kind: OpsNotifyKind;
  subject: string;
  text: string;
  meta?: Record<string, unknown>;
};

export function parseOpsNotifyPayload(body: unknown): OpsNotifyPayload | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Ugyldig JSON' };
  }
  const raw = body as Record<string, unknown>;
  const kind = typeof raw.kind === 'string' ? raw.kind.trim() : '';
  if (!OPS_NOTIFY_KINDS.includes(kind as OpsNotifyKind)) {
    return { error: 'Ugyldig kind' };
  }
  const subject = typeof raw.subject === 'string' ? raw.subject.trim() : '';
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (!subject || !text) {
    return { error: 'Mangler subject eller text' };
  }
  const meta =
    raw.meta && typeof raw.meta === 'object' && !Array.isArray(raw.meta)
      ? (raw.meta as Record<string, unknown>)
      : {};
  return { kind: kind as OpsNotifyKind, subject: subject.slice(0, 200), text, meta };
}

export async function deliverOpsNotify(payload: OpsNotifyPayload): Promise<{
  logged: boolean;
  emailsSent: number;
  skipped?: string;
}> {
  let logged = false;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const service = getServiceSupabase();
      const { error } = await service.rpc('n8n_log_ops_event', {
        p_kind: payload.kind,
        p_subject: payload.subject,
        p_payload: { text: payload.text, ...payload.meta },
      });
      logged = !error;
      if (error) {
        console.warn('[ops-notify] Kunne ikke logge hendelse:', error.message);
      }
    } catch (error) {
      console.warn('[ops-notify] Logging feilet:', error);
    }
  }

  if (!isSmtpConfigured()) {
    return { logged, emailsSent: 0, skipped: 'smtp_not_configured' };
  }

  const admins = await listAppAdmins();
  const emails = [...new Set(admins.map((admin) => admin.email).filter(Boolean))] as string[];
  if (emails.length === 0) {
    return { logged, emailsSent: 0, skipped: 'no_admin_emails' };
  }

  let emailsSent = 0;
  for (const to of emails) {
    try {
      await sendOpsNotificationEmail({
        to,
        subject: `[Folkets Stemme] ${payload.subject}`,
        text: payload.text,
      });
      emailsSent += 1;
    } catch (error) {
      console.error('[ops-notify] E-post feilet:', error);
    }
  }

  return { logged, emailsSent };
}
