import { NextResponse } from 'next/server';
import { cronAuthResponse, verifyCronAuth } from '@/lib/cron-auth';
import { sendOpsAlertEmail } from '@/lib/email/nodemailer';
import { isSmtpConfigured } from '@/lib/email/smtp-config';
import { opsAlertRecipient, parseN8nNotifyPayload } from '@/lib/ops/n8n-notify';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = verifyCronAuth(request);
  if (!auth.ok) {
    return cronAuthResponse(auth);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
  }

  const payload = parseN8nNotifyPayload(body);
  if (!payload) {
    return NextResponse.json({ error: 'Mangler subject eller text' }, { status: 400 });
  }

  console.error('[n8n-notify]', {
    kind: payload.kind,
    subject: payload.subject,
    meta: payload.meta,
    text: payload.text,
  });

  let emailed = false;
  if (isSmtpConfigured()) {
    try {
      await sendOpsAlertEmail({
        to: opsAlertRecipient(),
        subject: payload.subject,
        text: payload.text,
      });
      emailed = true;
    } catch (error) {
      console.error('[n8n-notify] SMTP send failed', error);
    }
  }

  return NextResponse.json({
    ok: true,
    kind: payload.kind,
    emailed,
    skipped: emailed ? undefined : isSmtpConfigured() ? 'smtp_send_failed' : 'smtp_not_configured',
  });
}
