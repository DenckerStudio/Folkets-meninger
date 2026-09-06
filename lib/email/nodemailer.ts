import nodemailer from 'nodemailer';
import { digestEmailSubject } from '@/lib/notifications/digest';
import { getSmtpConfig } from '@/lib/email/smtp-config';
import type { DigestFrequency } from '@/lib/notifications/channels';
import type { PreparedDigest } from '@/lib/notifications/enrichment';
import { STEMME_PLUS_MONTHLY_PRICE_NOK } from '@/lib/stemme-plus/constants';

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const { host, port, user, pass } = getSmtpConfig();

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return cachedTransporter;
}

export type WelcomeEmailInput = {
  to: string;
  name?: string | null;
};

export async function sendWelcomeEmail(input: WelcomeEmailInput) {
  const transporter = getTransporter();
  const { from } = getSmtpConfig();

  const subject = 'Velkommen til Folkets Stemme';
  const greeting = input.name?.trim() ? `Hei ${input.name.trim()}!` : 'Hei!';
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5;">
      <h2>${greeting}</h2>
      <p>Takk for at du registrerte deg. Du kan nå følge saker, stemme og få varsler om det du bryr deg om.</p>
      <p>Hilsen<br/>Folkets Stemme</p>
    </div>
  `.trim();

  await transporter.sendMail({ from, to: input.to, subject, html });
}

export type RealtimeNotificationEmailInput = {
  to: string;
  subject: string;
  title: string;
  body?: string | null;
  url?: string | null;
};

export async function sendRealtimeNotificationEmail(input: RealtimeNotificationEmailInput) {
  const transporter = getTransporter();
  const { from } = getSmtpConfig();

  const link = input.url
    ? `<p><a href="${input.url}" target="_blank" rel="noreferrer">Åpne i Folkets Stemme</a></p>`
    : '';

  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5;">
      <h3 style="margin:0 0 12px 0;">${input.title}</h3>
      ${input.body ? `<p style="margin:0 0 12px 0;">${escapeHtml(input.body)}</p>` : ''}
      ${link}
    </div>
  `.trim();

  await transporter.sendMail({ from, to: input.to, subject: input.subject, html });
}

export type DigestEmailInput = {
  to: string;
  frequency: DigestFrequency;
  digest: PreparedDigest;
};

export async function sendDigestEmail(input: DigestEmailInput) {
  const transporter = getTransporter();
  const { from } = getSmtpConfig();

  const subject = digestEmailSubject(input.frequency, input.digest.isTeaser);
  const html = buildDigestEmailHtml(input.digest);

  await transporter.sendMail({ from, to: input.to, subject, html });
}

function buildDigestEmailHtml(digest: PreparedDigest): string {
  const sections: string[] = [];

  if (digest.groupedByChannel.length > 0) {
    for (const group of digest.groupedByChannel) {
      const items = group.items
        .map((item) => renderDigestItem(item, true))
        .join('');
      sections.push(`
        <h4 style="margin:16px 0 8px 0;font-size:14px;color:#374151;">${escapeHtml(group.label)}</h4>
        <ul style="padding-left:18px;margin:0;">${items}</ul>
      `);
    }
  } else {
    const list = digest.items.map((item) => renderDigestItem(item, digest.items.some((i) => i.body))).join('');
    sections.push(`<ul style="padding-left: 18px; margin: 0;">${list || '<li>Ingen nye varsler.</li>'}</ul>`);
  }

  const teaserNote = digest.isTeaser
    ? `<p style="margin:16px 0 0 0;font-size:13px;color:#6b7280;">Dette er en kort smakebit (maks ${digest.maxItems} saker). Med Stemme+ (${STEMME_PLUS_MONTHLY_PRICE_NOK} kr/mnd) får du full oppsummering med mer kontekst og sanntidsvarsler.</p>`
    : '';

  return `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5;">
      <h3 style="margin:0 0 12px 0;">${digest.isTeaser ? 'Ukentlig smakebit' : 'Din oppsummering'}</h3>
      ${sections.join('')}
      ${teaserNote}
    </div>
  `.trim();
}

function renderDigestItem(
  item: { title: string; body?: string | null; url?: string | null; createdAt: string },
  includeBody: boolean,
): string {
  const safeTitle = escapeHtml(item.title);
  const link = item.url ? ` <a href="${item.url}" target="_blank" rel="noreferrer">Åpne</a>` : '';
  const body =
    includeBody && item.body
      ? `<div style="font-size:13px;color:#4b5563;margin-top:2px;">${escapeHtml(item.body)}</div>`
      : '';
  const date = formatDigestDate(item.createdAt);
  return `<li style="margin-bottom:8px;"><strong>${safeTitle}</strong>${link}${body}<div style="font-size:12px;color:#9ca3af;margin-top:2px;">${date}</div></li>`;
}

function formatDigestDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('nb-NO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type SiteFeedbackEmailInput = {
  name?: string | null;
  email: string;
  category: string;
  message: string;
};

/** Best-effort notify inbox for public “Gi innspill” form. Requires SMTP env. */
export async function sendSiteFeedbackEmail(input: SiteFeedbackEmailInput) {
  const transporter = getTransporter();
  const { from } = getSmtpConfig();
  const to = process.env.FEEDBACK_INBOX_EMAIL?.trim() || 'kontakt@folketsstemme.no';

  const subject = `[Innspill] ${input.category} — ${input.email}`;
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5;">
      <h2 style="margin:0 0 12px 0;">Nytt innspill</h2>
      <p style="margin:0 0 8px 0;"><strong>Kategori:</strong> ${escapeHtml(input.category)}</p>
      <p style="margin:0 0 8px 0;"><strong>Navn:</strong> ${escapeHtml(input.name?.trim() || 'Ikke oppgitt')}</p>
      <p style="margin:0 0 8px 0;"><strong>E-post:</strong> ${escapeHtml(input.email)}</p>
      <p style="margin:16px 0 0 0; white-space:pre-wrap;">${escapeHtml(input.message)}</p>
    </div>
  `.trim();

  await transporter.sendMail({
    from,
    to,
    replyTo: input.email,
    subject,
    html,
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

