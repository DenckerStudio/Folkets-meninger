import type { DigestFrequency } from '@/lib/notifications/channels';
import type { WeeklyOverview } from '@/lib/weekly-overview';

export const DIGEST_DEFAULT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/** Off by default until owner enables WEEKLY_OVERVIEW_DIGEST_ENABLED on fm-web. */
export function isWeeklyOverviewDigestEnabled(): boolean {
  return process.env.WEEKLY_OVERVIEW_DIGEST_ENABLED?.trim() === 'true';
}

export type DigestItem = {
  title: string;
  url?: string | null;
  createdAt: string;
};

export function resolveDigestSinceIso(
  lastSentIso: string | undefined,
  nowMs = Date.now(),
): string {
  if (lastSentIso) {
    const parsed = new Date(lastSentIso);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date(nowMs - DIGEST_DEFAULT_LOOKBACK_MS).toISOString();
}

export function toAbsoluteNotificationUrl(
  url: string | null | undefined,
  origin: string,
): string | null | undefined {
  if (!url) return url;
  return url.startsWith('/') ? `${origin}${url}` : url;
}

export function shouldSendDigestEmail(items: DigestItem[]): boolean {
  return items.length > 0;
}

export function buildDigestCursorUpdate(
  previous: Record<string, string> | null | undefined,
  channels: string[],
  sentAtIso: string,
): Record<string, string> {
  const next = { ...(previous || {}) };
  for (const channel of channels) {
    next[channel] = sentAtIso;
  }
  return next;
}

export function digestEmailSubject(frequency: DigestFrequency, isTeaser = false): string {
  if (isTeaser) {
    return 'Dine varsler (ukentlig smakebit)';
  }
  return frequency === 'daily'
    ? 'Dine varsler (daglig oppsummering — Stemme+)'
    : 'Dine varsler (ukentlig oppsummering — Stemme+)';
}

/** Free users' weekly digest: one summarized in-app notification (no e-mail). */
export function buildWeeklyOverviewDigestPlainBlock(
  overview: Pick<
    WeeklyOverview,
    | 'votingSoon'
    | 'votedRecently'
    | 'openHearings'
    | 'newSummaries'
    | 'skriftligeSporsmal'
    | 'window'
  >,
  pageUrl: string,
): string {
  const bullets: string[] = [];
  if (overview.votingSoon.length > 0) {
    bullets.push(
      `${overview.votingSoon.length} sak${overview.votingSoon.length === 1 ? '' : 'er'} nær votering (${overview.window.futureRangeLabel.toLowerCase()})`,
    );
  }
  if (overview.votedRecently.length > 0) {
    bullets.push(
      `${overview.votedRecently.length} nylig votert (${overview.window.pastRangeLabel.toLowerCase()})`,
    );
  }
  if (overview.openHearings.length > 0) {
    bullets.push(
      `${overview.openHearings.length} høring${overview.openHearings.length === 1 ? '' : 'er'} med frist snart`,
    );
  }
  if (overview.newSummaries.length > 0) {
    bullets.push(
      `${overview.newSummaries.length} oppdatert${overview.newSummaries.length === 1 ? '' : 'e'} sammendrag`,
    );
  }
  if (overview.skriftligeSporsmal.count > 0) {
    bullets.push(overview.skriftligeSporsmal.label);
  }

  const lines = ['Dette skjer nå', overview.window.label];
  for (const bullet of bullets) {
    lines.push(`• ${bullet}`);
  }
  lines.push(`Les hele ukeoversikten: ${pageUrl}`);
  return lines.join('\n');
}

export function buildWeeklyOverviewDigestHtmlBlock(plainBlock: string, pageUrl: string): string {
  const body = escapeDigestHtml(plainBlock).replaceAll('\n', '<br/>');
  return `
    <div style="margin:20px 0 0 0;padding-top:16px;border-top:1px solid #e5e7eb;">
      <h4 style="margin:0 0 8px 0;font-size:14px;color:#374151;">Dette skjer nå</h4>
      <p style="margin:0 0 8px 0;font-size:14px;color:#374151;">${body}</p>
      <p style="margin:0;"><a href="${pageUrl}" target="_blank" rel="noreferrer">Åpne ukeoversikten</a></p>
    </div>
  `.trim();
}

export function mergeWeeklyOverviewIntoDigestBody(
  body: string,
  overviewBlock: string | null | undefined,
): string {
  if (!overviewBlock?.trim()) return body;
  return `${body}\n\n${overviewBlock}`;
}

export function buildInAppDigestSummary(
  items: Array<{ title: string }>,
  maxTitles = 3,
): { title: string; body: string; url: string } {
  const count = items.length;
  const titles = items.slice(0, maxTitles).map((i) => `• ${i.title}`);
  const rest = count - titles.length;
  const lines = [...titles, ...(rest > 0 ? [`… og ${rest} til`] : [])];
  return {
    title: `Ukens oppsummering: ${count} ${count === 1 ? 'nytt varsel' : 'nye varsler'}`,
    body: lines.join('\n'),
    url: '/dashboard',
  };
}

function escapeDigestHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
