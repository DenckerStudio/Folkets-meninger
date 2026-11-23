/**
 * Conservative User-Agent bot / crawler detection for first-party analytics.
 * Prefer false negatives (count a weird browser) over false positives (drop a human).
 */

const BOT_UA_PATTERNS: readonly RegExp[] = [
  /\bbot\b/i,
  /\bcrawl/i,
  /\bspider\b/i,
  /\bslurp\b/i,
  /\bfacebookexternalhit\b/i,
  /\bfacebot\b/i,
  /\btwitterbot\b/i,
  /\blinkedinbot\b/i,
  /\bwhatsapp\b/i,
  /\btelegram/i,
  /\bdiscordbot\b/i,
  /\bpreview\b/i,
  /\bembedly\b/i,
  /\bquora link preview\b/i,
  /\bpingdom\b/i,
  /\buptimerobot\b/i,
  /\bstatuscake\b/i,
  /\bheadlesschrome\b/i,
  /\bphantomjs\b/i,
  /\bselenium\b/i,
  /\bhttpclient\b/i,
  /\bpython-requests\b/i,
  /\bgo-http-client\b/i,
  /\bjava\//i,
  /\bwget\b/i,
  /\bcurl\b/i,
  /\blibwww-perl\b/i,
  /\bahrefs/i,
  /\bsemrush/i,
  /\bmj12bot\b/i,
  /\bdotbot\b/i,
  /\bbingpreview\b/i,
  /\byandex/i,
  /\bbaiduspider\b/i,
  /\bduckduckbot\b/i,
  /\bapplebot\b/i,
  /\bgooglebot\b/i,
  /\bbingbot\b/i,
  /\bpetalbot\b/i,
  /\bbytespider\b/i,
  /\bgptbot\b/i,
  /\bclaudebot\b/i,
  /\bccbot\b/i,
  /\bia_archiver\b/i,
];

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  const ua = userAgent?.trim();
  if (!ua) {
    return true;
  }
  return BOT_UA_PATTERNS.some((pattern) => pattern.test(ua));
}
