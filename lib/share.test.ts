import { redditCommunityName, redditSubmitLinkUrl, redditSubmitQuoteUrl, clampShareTitle } from '@/lib/reddit';
import {
  emailShareUrl,
  facebookShareUrl,
  formatQuoteShareText,
  linkedInShareUrl,
  sakAbsoluteUrl,
  shareChannelUrl,
  twitterIntentUrl,
} from '@/lib/share';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(redditCommunityName() === 'FolketsMeninger', 'default community');
assert(clampShareTitle('abc', 3) === 'abc', 'short title');
assert(clampShareTitle('abcdefghij', 6).endsWith('…'), 'truncated title');

const link = redditSubmitLinkUrl({
  title: 'Energi og klima',
  url: 'https://folketsstemme.no/dashboard/sak/1',
});
assert(link.includes('/r/FolketsMeninger/submit'), 'reddit submit path');
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
assert(shareChannelUrl('reddit', { title: 'Sak', url: 'https://x.test' })?.includes('FolketsMeninger'), 'reddit channel');

console.log('share/reddit tests OK');
