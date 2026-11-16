import assert from 'node:assert/strict';
import { waitForElementById } from '@/lib/sak/page-search-nav';

type FakeDoc = {
  getElementById: (id: string) => { id: string } | null;
  body: { nodeType: number };
};

function installFakeDocument(fake: FakeDoc) {
  (globalThis as { document?: FakeDoc }).document = fake;
}

const previousDocument = (globalThis as { document?: FakeDoc }).document;

installFakeDocument({
  body: { nodeType: 1 },
  getElementById: (id) => (id === 'ready' ? { id } : null),
});

void (async () => {
  const hit = await waitForElementById('ready', { timeoutMs: 200, pollMs: 10 });
  assert.ok(hit);

  let created = false;
  installFakeDocument({
    body: { nodeType: 1 },
    getElementById: (id) => {
      if (id === 'late' && created) return { id };
      return null;
    },
  });

  const pending = waitForElementById('late', { timeoutMs: 250, pollMs: 15 });
  globalThis.setTimeout(() => {
    created = true;
  }, 40);
  const late = await pending;
  assert.ok(late);

  installFakeDocument({
    body: { nodeType: 1 },
    getElementById: () => null,
  });
  const missing = await waitForElementById('missing', { timeoutMs: 80, pollMs: 20 });
  assert.equal(missing, null);

  if (previousDocument === undefined) {
    delete (globalThis as { document?: FakeDoc }).document;
  } else {
    (globalThis as { document?: FakeDoc }).document = previousDocument;
  }

  console.log('lib/sak/page-search-nav.test.ts: ok');
})();