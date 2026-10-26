import assert from 'node:assert/strict';
import { parseMarkdown } from './markdown';
import { chatSourceHref, collectChatSourceLinks, isInAppNavigationClick } from './source-links';

// [n] parses as a citation; markdown links still win.
const [para] = parseMarkdown('Forslaget gjelder vektgrensen [1][2]. Se [Stortinget](https://stortinget.no) og [3].');
assert.equal(para.type, 'paragraph');
if (para.type === 'paragraph') {
  const citations = para.nodes.filter((node) => node.type === 'citation');
  assert.deepEqual(citations, [
    { type: 'citation', n: 1 },
    { type: 'citation', n: 2 },
    { type: 'citation', n: 3 },
  ]);
  assert.ok(para.nodes.some((node) => node.type === 'link' && node.href === 'https://stortinget.no'));
}
const [listBlock] = parseMarkdown('- [1] Dokument 8:314 S');
assert.equal(listBlock.type, 'list');

// Hrefs use the existing app routes.
const base = { title: 'T', issueId: null, documentId: null, hearingId: null, personId: null, pollId: null, url: null };
assert.deepEqual(chatSourceHref({ ...base, n: 1, kind: 'sak', issueId: '200365' }), {
  href: '/dashboard/sak/200365',
  external: false,
});
assert.deepEqual(
  chatSourceHref({ ...base, n: 2, kind: 'dokument', issueId: '200365', documentId: 'DOK 8/314' }),
  { href: '/dashboard/sak/200365?dokument=DOK%208%2F314#dokumenter', external: false },
);
assert.deepEqual(
  chatSourceHref({
    ...base,
    n: 9,
    kind: 'dokument',
    issueId: '200365',
    documentId: 'prop-123',
    url: 'https://www.stortinget.no/no/Sak/?p=200365',
  }),
  {
    href: '/dashboard/sak/200365?dokument=prop-123#dokumenter',
    external: false,
  },
);
// Hearing RAG excerpts cite kind dokument with hearingId only (no sak) — stay in-app.
assert.deepEqual(
  chatSourceHref({
    ...base,
    n: 11,
    kind: 'dokument',
    issueId: null,
    documentId: 'horingsprogram',
    hearingId: '10005945',
    url: null,
  }),
  { href: '/dashboard/horinger/10005945', external: false },
);
assert.deepEqual(
  chatSourceHref({
    ...base,
    n: 12,
    kind: 'dokument',
    issueId: null,
    documentId: 'horingsprogram',
    hearingId: '10005945',
    url: 'https://www.stortinget.no/no/Hva-skjer-pa-Stortinget/Horing/',
  }),
  { href: '/dashboard/horinger/10005945', external: false },
);
assert.deepEqual(
  chatSourceHref({
    ...base,
    n: 10,
    kind: 'dokument',
    issueId: null,
    documentId: null,
    url: 'https://www.stortinget.no/no/Saker-og-publikasjoner/Publikasjoner/Innstillinger/',
  }),
  {
    href: 'https://www.stortinget.no/no/Saker-og-publikasjoner/Publikasjoner/Innstillinger/',
    external: true,
  },
);
assert.deepEqual(chatSourceHref({ ...base, n: 3, kind: 'høring', hearingId: '10005945' }), {
  href: '/dashboard/horinger/10005945',
  external: false,
});
assert.deepEqual(chatSourceHref({ ...base, n: 4, kind: 'høring', issueId: '200365' }), {
  href: '/dashboard/sak/200365',
  external: false,
});
assert.deepEqual(chatSourceHref({ ...base, n: 5, kind: 'nett', url: 'https://www.nrk.no/a' }), {
  href: 'https://www.nrk.no/a',
  external: true,
});
assert.equal(chatSourceHref({ ...base, n: 6, kind: 'nett', url: 'javascript:alert(1)' }), null);
assert.deepEqual(chatSourceHref({ ...base, n: 7, kind: 'politiker', personId: 'KANO' }), {
  href: '/dashboard/politikere/KANO',
  external: false,
});
assert.deepEqual(chatSourceHref({ ...base, n: 8, kind: 'avstemning', pollId: 'p1' }), {
  href: '/dashboard/avstemninger/p1',
  external: false,
});

// In-app link taps close the chat; new-tab, modified and external clicks don't.
const origin = 'https://folketsmeninger.no';
const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
const anchor = { href: '/dashboard/sak/200365', target: null, download: false };
assert.equal(isInAppNavigationClick(click, anchor, origin), true);
assert.equal(isInAppNavigationClick(click, { ...anchor, href: `${origin}/dashboard/sak/1#dokumenter` }, origin), true);
assert.equal(isInAppNavigationClick(click, { ...anchor, target: '_blank' }, origin), false);
assert.equal(isInAppNavigationClick(click, { ...anchor, href: 'https://www.nrk.no/a' }, origin), false);
assert.equal(isInAppNavigationClick(click, { ...anchor, href: '#x' }, origin), false);
assert.equal(isInAppNavigationClick({ ...click, metaKey: true }, anchor, origin), false);
assert.equal(isInAppNavigationClick({ ...click, button: 1 }, anchor, origin), false);
assert.equal(isInAppNavigationClick(click, { ...anchor, download: true }, origin), false);

// Collected per message from finished tool parts only.
const links = collectChatSourceLinks([
  { type: 'text', text: 'hei [1]' },
  {
    type: 'tool-retrieveSakContext',
    state: 'output-available',
    output: {
      kilder: [
        { n: 1, kind: 'sak', title: 'Vektgrense', issueId: '200365', documentId: null, hearingId: null, url: null },
        { n: 2, kind: 'dokument', title: 'Dok 8', issueId: '200365', documentId: 'D1', hearingId: null, url: null },
        { n: 'x', kind: 'sak' },
      ],
    },
  },
  { type: 'tool-listOpenHearings', state: 'input-available', output: { kilder: [{ n: 3, kind: 'nett', url: 'https://x.no' }] } },
]);
assert.deepEqual([...links.keys()], [1, 2]);
assert.equal(links.get(2)?.href, '/dashboard/sak/200365?dokument=D1#dokumenter');
assert.equal(links.get(1)?.title, 'Vektgrense');

console.log('lib/chat/source-links.test.ts ok');
