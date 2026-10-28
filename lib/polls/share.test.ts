import {
  buildPollEmbedSnippet,
  buildPollEmbedUrl,
  buildPollShareChannelUrl,
  buildPollShareRelativePath,
  buildPollShareText,
  buildPollShareUrl,
  DEFAULT_SITE_ORIGIN,
  isPollChoice,
  isShareablePoll,
  normalizeOrigin,
  pollEmbedPath,
  pollSharePath,
  POLL_BALLOT_CHOICES,
  resolveShareOrigin,
} from '@/lib/polls/share';
import { pollChoiceLabel } from '@/lib/polls/labels';
import { parsePollEmbedOptions } from '@/lib/polls/embed';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(normalizeOrigin('folkets-meninger.no') === 'https://folkets-meninger.no', 'adds protocol');
assert(normalizeOrigin('https://www.folkets-meninger.no/') === DEFAULT_SITE_ORIGIN, 'normalizes');
assert(normalizeOrigin('nonsense') === 'https://nonsense', 'adds protocol to bare host');
assert(normalizeOrigin('https://') === DEFAULT_SITE_ORIGIN, 'fallback on invalid');
assert(normalizeOrigin('') === DEFAULT_SITE_ORIGIN, 'fallback on empty');

assert(
  resolveShareOrigin({ configured: 'https://www.folkets-meninger.no' }) === DEFAULT_SITE_ORIGIN,
  'configured wins',
);
assert(
  resolveShareOrigin({ host: 'preview.example.no', forwardedProto: 'https' }) ===
    DEFAULT_SITE_ORIGIN,
  'non-local host without configured origin uses canonical default',
);
assert(
  resolveShareOrigin({ host: 'localhost:3000' }) === 'http://localhost:3000',
  'localhost uses http',
);
assert(resolveShareOrigin({ forwardedProto: 'https' }) === DEFAULT_SITE_ORIGIN, 'default host');
assert(
  resolveShareOrigin({
    configured: 'https://www.folkets-meninger.no',
    host: 'folkets-meninger.no',
    forwardedProto: 'https',
  }) === DEFAULT_SITE_ORIGIN,
  'configured origin wins over alias request host (Coolify / no VERCEL_ENV)',
);
assert(
  resolveShareOrigin({ host: 'localhost:3000', forwardedProto: 'http' }) ===
    'http://localhost:3000',
  'local dev uses request host',
);

assert(pollSharePath('abc-123') === '/del/abc-123', 'share path');
assert(pollSharePath('a/b') === '/del/a%2Fb', 'share path encodes');
assert(pollEmbedPath('abc-123') === '/embed/abc-123', 'embed path');
assert(
  buildPollShareUrl('abc-123', 'https://www.folkets-meninger.no') ===
    `${DEFAULT_SITE_ORIGIN}/del/abc-123`,
  'absolute share url',
);

assert(
  buildPollShareRelativePath('abc-123') === '/del/abc-123',
  'relative share path without query',
);
assert(
  buildPollShareRelativePath('abc-123', { choice: 'ja', ref: 'fb' }) ===
    '/del/abc-123?valg=ja&ref=fb',
  'relative share path carries valg + ref',
);

const facebookChannel = buildPollShareChannelUrl('abc-123', undefined, 'facebook');
assert(facebookChannel.includes('utm_source=facebook'), 'facebook utm source');
assert(facebookChannel.includes('utm_medium=social'), 'facebook utm medium');
assert(facebookChannel.includes('ref=fb'), 'facebook ref');
assert(!facebookChannel.includes('?valg='), 'channel url has no valg');

const copyChannel = buildPollShareChannelUrl('abc-123', undefined, 'copy');
assert(copyChannel.includes('utm_source=copy') && copyChannel.includes('ref=cp'), 'copy channel utm');

const embedChannel = buildPollShareChannelUrl('abc-123', undefined, 'embed');
assert(embedChannel.includes('ref=embed'), 'embed channel ref');
assert(!embedChannel.includes('utm_'), 'embed channel has no utm');

const blueskyChannel = buildPollShareChannelUrl('abc-123', undefined, 'bluesky');
assert(blueskyChannel.includes('utm_source=bluesky') && blueskyChannel.includes('ref=bs'), 'bluesky channel utm');

const smsChannel = buildPollShareChannelUrl('abc-123', undefined, 'sms');
assert(smsChannel.includes('utm_medium=messaging') && smsChannel.includes('ref=sms'), 'sms channel utm');

assert(
  buildPollEmbedUrl('abc-123', 'https://www.folkets-meninger.no', { theme: 'dark', size: 'compact', ref: 'partner' }) ===
    'https://www.folkets-meninger.no/embed/abc-123?theme=dark&size=compact&ref=partner',
  'embed url carries validated options',
);

const snippet = buildPollEmbedSnippet({
  pollId: 'abc-123',
  origin: 'https://www.folkets-meninger.no',
  title: 'Spørsmål <med> "fnutter" & tegn',
  options: { theme: 'auto', size: 'full' },
  autoHeight: true,
});
assert(snippet.includes('src="https://www.folkets-meninger.no/embed/abc-123?theme=auto&amp;size=full"'), 'snippet src');
assert(snippet.includes('data-fm-embed'), 'snippet marks embeddable frame');
assert(snippet.includes('referrerpolicy="strict-origin-when-cross-origin"'), 'snippet referrer policy');
assert(snippet.includes('&lt;med&gt;'), 'snippet escapes < and >');
assert(snippet.includes('&amp;'), 'snippet escapes ampersand');
assert(snippet.includes('&quot;fnutter&quot;'), 'snippet escapes quotes');
assert(snippet.includes('embed.js'), 'auto-height snippet loads embed.js');

const plainSnippet = buildPollEmbedSnippet({
  pollId: 'abc-123',
  origin: 'https://www.folkets-meninger.no',
  autoHeight: false,
});
assert(!plainSnippet.includes('embed.js'), 'plain snippet omits embed.js');
assert(plainSnippet.startsWith('<iframe') && plainSnippet.endsWith('</iframe>'), 'plain snippet is an iframe');

const options = parsePollEmbedOptions(new URLSearchParams('theme=dark&size=compact&radius=99&ref=Partner!'));
assert(options.theme === 'dark', 'embed theme parsed');
assert(options.size === 'compact', 'embed size parsed');
assert(options.radius === 16, 'invalid radius falls back');
assert(options.ref === null, 'invalid ref rejected');
assert(options.summary === false, 'compact hides summary');

const defaults = parsePollEmbedOptions(new URLSearchParams(''));
assert(defaults.theme === 'auto' && defaults.size === 'full' && defaults.border, 'embed defaults');
assert(defaults.summary === true, 'full shows summary by default');

assert(isPollChoice('ja') && isPollChoice('blank') && isPollChoice('nei'), 'valid choices');
assert(!isPollChoice('kanskje'), 'invalid choice');

assert(
  isShareablePoll({ track: 'stortinget', status: 'open' }) &&
    isShareablePoll({ track: 'system', status: 'closed' }),
  'official published polls are shareable',
);
assert(!isShareablePoll({ track: 'citizen', status: 'open' }), 'citizen polls are not shareable');
assert(!isShareablePoll({ track: 'system', status: 'draft' }), 'drafts are not shareable');
assert(!isShareablePoll(null), 'missing poll is not shareable');

assert(
  POLL_BALLOT_CHOICES.length === 3 &&
    POLL_BALLOT_CHOICES[0] === 'nei' &&
    POLL_BALLOT_CHOICES[1] === 'blank' &&
    POLL_BALLOT_CHOICES[2] === 'ja',
  'share re-exports ballot button order nei/blank/ja',
);
assert(pollChoiceLabel('ja') === 'Ja', 'ja label');
assert(pollChoiceLabel('blank') === 'Blank', 'blank label');
assert(pollChoiceLabel('nei') === 'Nei', 'nei label');
assert(
  buildPollShareText('Test?') === 'Test? Hva mener du? Svar nei, blank eller ja.',
  'share text',
);

console.log('polls share tests OK');
