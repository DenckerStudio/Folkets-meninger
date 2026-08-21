import { redditCommunityName, redditSubmitLinkUrl, redditSubmitQuoteUrl, clampShareTitle, redditOAuthStartPath, parseRedditIntentFromSearch, absolutizeRedditIntent, redditHrefForIntent } from '@/lib/reddit';
import { redditAuthorizeUrl, redditBasicAuthHeader, hasJoinedReddit } from '@/lib/reddit-oauth';
import {
  emailShareUrl,
  facebookShareUrl,
  formatQuoteShareText,
  linkedInShareUrl,
  sakAbsoluteUrl,
  shareChannelUrl,
  twitterIntentUrl,
  siteOrigin,
  buildSakShareDescription,
  buildSakShareMeta,
  clampShareDescription,
} from '@/lib/share';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(redditCommunityName() === 'Folkets_meninger', 'default community');
assert(clampShareTitle('abc', 3) === 'abc', 'short title');
assert(clampShareTitle('abcdefghij', 6).endsWith('…'), 'truncated title');

const link = redditSubmitLinkUrl({
  title: 'Energi og klima',
  url: 'https://folketsstemme.no/dashboard/sak/1',
});
assert(link.includes('/r/Folkets_meninger/submit'), 'reddit submit path');
assert(link.includes('url='), 'reddit url param');

const quoteUrl = redditSubmitQuoteUrl({
  title: 'Sak',
  url: 'https://example.test/sak/1',
  quote: 'Dette er et sitat',
  sourceLabel: 'Innstilling',
});
const quoteParams = new URL(quoteUrl).searchParams;
assert(quoteParams.get('type') === 'TEXT', 'quote is text post');
assert((quoteParams.get('text') ?? '').includes('> Dette er et sitat'), 'quoted body');

assert(
  sakAbsoluteUrl('https://folketsstemme.no/', '200329') ===
    'https://folketsstemme.no/dashboard/sak/200329',
  'absolute sak url',
);

assert(siteOrigin() === 'https://folketsstemme.no', 'default site origin');
assert(
  buildSakShareDescription({
    title: 'Kort tittel',
    aiNarrative: 'Dette er AI-sammendraget som Reddit skal vise.',
    summary: 'Ikke denne',
  }) === 'Dette er AI-sammendraget som Reddit skal vise.',
  'og prefers ai narrative',
);
assert(
  buildSakShareDescription({
    title: 'Sak',
    innstillingstekst: '<p>Innstilling  om  klima</p>',
  }).includes('Innstilling om klima'),
  'og strips html from innstilling',
);
assert(clampShareDescription('a'.repeat(250)).endsWith('…'), 'og description truncated');
const og = buildSakShareMeta({
  sakId: '200329',
  title: 'Endringer i forretningsorden',
  description: 'Kort beskrivelse',
});
assert(og.title === 'Endringer i forretningsorden', 'og title');
assert(og.description === 'Kort beskrivelse', 'og description');
assert(og.url.endsWith('/dashboard/sak/200329'), 'og canonical sak url');

const quoteText = formatQuoteShareText({
  quote: 'Folkets mening teller',
  title: 'Sakstittel',
  url: 'https://example.test/sak/1',
  sourceLabel: 'AI-sammendrag',
});
assert(quoteText.includes('«Folkets mening teller»'), 'quote marks');
assert(quoteText.includes('AI-sammendrag'), 'source label');

assert(twitterIntentUrl({ title: 'Sak', url: 'https://example.test/s' }).includes('twitter.com/intent/tweet'), 'x');
assert(facebookShareUrl('https://example.test/s').includes('facebook.com/sharer'), 'facebook');
assert(linkedInShareUrl('https://example.test/s').includes('linkedin.com/sharing'), 'linkedin');
assert(emailShareUrl({ title: 'Sak', url: 'https://example.test/s' }).startsWith('mailto:'), 'email');
assert(shareChannelUrl('copy', { title: 'Sak', url: 'https://x.test' }) === null, 'copy has no url');
assert(shareChannelUrl('reddit', { title: 'Sak', url: 'https://x.test' })?.includes('Folkets_meninger'), 'reddit channel');

const start = redditOAuthStartPath({
  kind: 'submit',
  title: 'Sak',
  url: '/dashboard/sak/1',
  next: '/dashboard/sak/1',
});
assert(start.startsWith('/api/reddit/start'), 'oauth start path');
assert(
  redditHrefForIntent({ kind: 'submit', title: 'Sak', url: 'https://folketsstemme.no/dashboard/sak/1' }, true).startsWith(
    '/api/reddit/start',
  ),
  'join still uses oauth',
);
assert(
  redditHrefForIntent({ kind: 'submit', title: 'Sak', url: 'https://folketsstemme.no/dashboard/sak/1' }, false).includes(
    '/r/Folkets_meninger/submit',
  ),
  'after join uses reddit submit',
);
const parsed = parseRedditIntentFromSearch(new URLSearchParams(start.split('?')[1] ?? ''));
assert(parsed.kind === 'submit', 'parsed submit intent');
assert(
  absolutizeRedditIntent('https://folketsstemme.no', parsed).url ===
    'https://folketsstemme.no/dashboard/sak/1',
  'absolutize relative sak url',
);
const authorize = redditAuthorizeUrl({
  clientId: 'abc',
  redirectUri: 'https://folketsstemme.no/api/reddit/callback',
  state: 's1',
});
assert(authorize.startsWith('https://www.reddit.com/api/v1/authorize'), 'authorize host');
assert(decodeURIComponent(new URL(authorize).searchParams.get('scope') ?? '') === 'identity subscribe', 'authorize scopes');
assert(hasJoinedReddit('1') === true, 'cookie marks joined');
assert(hasJoinedReddit(undefined, 'joined') === true, 'query marks joined');
assert(hasJoinedReddit(undefined, 'denied') === false, 'denied is not joined');

console.log('share/reddit tests OK');
