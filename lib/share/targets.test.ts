import assert from 'node:assert/strict';
import {
  buildShareTargetUrl,
  resolveShareUrl,
  SHARE_TARGETS,
  SHARE_TARGET_LABELS,
  shareDisplayHost,
  shareTargetOpensNewTab,
} from '@/lib/share/targets';

const url = 'https://www.folkets-meninger.no/dashboard/sak/123';
const input = { url, title: 'Tittel på sak', text: 'Se saken' };

assert.ok(!(SHARE_TARGETS as string[]).includes('x'), 'X is not offered');
assert.ok(!(SHARE_TARGETS as string[]).includes('reddit'), 'Reddit is not offered');
for (const target of SHARE_TARGETS) {
  assert.ok(SHARE_TARGET_LABELS[target], `label for ${target}`);
  assert.ok(buildShareTargetUrl(target, input).length > 0, `url for ${target}`);
}

assert.equal(
  buildShareTargetUrl('facebook', input),
  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
);
assert.equal(
  buildShareTargetUrl('linkedin', input),
  `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
);

const bluesky = new URL(buildShareTargetUrl('bluesky', input));
assert.equal(bluesky.origin, 'https://bsky.app');
assert.equal(bluesky.searchParams.get('text'), `Se saken\n${url}`);

const whatsapp = new URL(buildShareTargetUrl('whatsapp', input));
assert.equal(whatsapp.searchParams.get('text'), `Se saken\n${url}`);

assert.equal(
  buildShareTargetUrl('sms', input),
  `sms:?&body=${encodeURIComponent(`Se saken\n${url}`)}`,
);

const email = buildShareTargetUrl('email', input);
assert.ok(email.startsWith('mailto:?subject=Tittel%20p%C3%A5%20sak&body='), 'mailto subject');
assert.ok(email.includes(encodeURIComponent(url)), 'mailto body carries url');

assert.equal(
  new URL(buildShareTargetUrl('bluesky', { url, title: 'Bare tittel' })).searchParams.get('text'),
  `Bare tittel\n${url}`,
  'falls back to title when text is missing',
);

assert.equal(shareTargetOpensNewTab('facebook'), true);
assert.equal(shareTargetOpensNewTab('sms'), false);
assert.equal(shareTargetOpensNewTab('email'), false);

assert.equal(resolveShareUrl(url), url, 'absolute url untouched');
assert.equal(
  resolveShareUrl('/dashboard/sak/1', 'http://localhost:3000'),
  'http://localhost:3000/dashboard/sak/1',
);
assert.equal(resolveShareUrl('dashboard/sak/1', 'https://a.no'), 'https://a.no/dashboard/sak/1');

assert.equal(shareDisplayHost(url), 'folkets-meninger.no');
assert.equal(shareDisplayHost('not a url'), '');

console.log('share targets: ok');
