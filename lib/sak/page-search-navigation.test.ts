import assert from 'node:assert/strict';
import {
  SAK_ARGUMENTER_SECTION_ANCHOR_ID,
  SAK_OVERSIKT_INNSTILLING_ANCHOR_ID,
  sakDocumentListAnchorId,
  sakOpinionAnchorId,
  sakPageTabPanelId,
} from '@/lib/sak/anchors';
import { focusSakSearchHit } from '@/lib/sak/page-search-nav';
import { searchSakPage } from '@/lib/sak/page-search';

const hits = searchSakPage({
  query: 'skole',
  title: 'Sak om skole',
  summary: 'Lang beskrivelse om skole i nærheten',
  documents: [{ id: 'doc-1', title: 'Innstilling skole' }],
  opinions: [{ id: 'op-1', title: 'Mening', body: 'Skole må styrkes i lokalmiljøet.' }],
  innstillingSnippet: 'Komiteen tilrår skolepakken.',
  argumentSnippets: [{ id: 'arg-1', text: 'Ap: Vi går inn for skolepakken i byen.', side: 'for' }],
});

const byKind = Object.fromEntries(hits.map((hit) => [hit.kind, hit]));

assert.equal(byKind.mening?.tab, 'diskusjon');
assert.equal(byKind.mening?.anchorId, sakOpinionAnchorId('op-1'));

assert.equal(byKind.innstilling?.tab, 'oversikt');
assert.equal(byKind.innstilling?.anchorId, SAK_OVERSIKT_INNSTILLING_ANCHOR_ID);

assert.equal(byKind.argument?.tab, 'argumenter');
assert.equal(byKind.argument?.anchorId, SAK_ARGUMENTER_SECTION_ANCHOR_ID);

assert.equal(byKind.dokument?.tab, 'dokumenter');
assert.equal(byKind.dokument?.anchorId, sakDocumentListAnchorId('doc-1'));

void (async () => {
  type FakeDoc = {
    getElementById: (id: string) => { id: string } | null;
    body: { nodeType: number };
  };

  const panels = new Set<string>();
  const anchors = new Set<string>();

  (globalThis as { window?: { dispatchEvent: (event: unknown) => boolean } }).window = {
    dispatchEvent: () => {
      panels.add('dokumenter');
      anchors.add('sak-dokument-liste-doc-1');
      return true;
    },
  };

  const fakeEl = (id: string) => ({
    id,
    tabIndex: -1,
    scrollIntoView: () => {},
    focus: () => {},
    classList: { add: () => {}, remove: () => {} },
    hasAttribute: () => false,
  });

  (globalThis as { document?: FakeDoc }).document = {
    body: { nodeType: 1 },
    getElementById: (id) => {
      if (id === sakPageTabPanelId('dokumenter') && panels.has('dokumenter')) return fakeEl(id);
      if (id === sakDocumentListAnchorId('doc-1') && anchors.has('sak-dokument-liste-doc-1')) return fakeEl(id);
      return null;
    },
  };

  const dokumentHit = byKind.dokument;
  assert.ok(dokumentHit);
  const ok = await focusSakSearchHit(dokumentHit.tab, dokumentHit.anchorId);
  assert.equal(ok, true);

  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { document?: FakeDoc }).document;

  console.log('lib/sak/page-search-navigation.test.ts: ok');
})();