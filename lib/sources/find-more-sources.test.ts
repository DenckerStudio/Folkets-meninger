import assert from 'node:assert/strict';
import { findMoreSources } from './find-more-sources';

async function run() {
  const fetchImpl = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            title: 'Nett artikkel',
            url: 'https://www.nrk.no/nyheter/1',
            content: 'Sitat fra nett',
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch;

  const prevWeb = process.env.WEB_SEARCH_URL;
  process.env.WEB_SEARCH_URL = 'https://searx.internal.test/';

  try {
    const result = await findMoreSources(
      { kind: 'issue', issueId: '103102' },
      {
        deps: {
          loadIssue: async () => ({
            id: '103102',
            title: 'Test sak',
            henvisning: null,
          }),
          loadTopic: async () => null,
          loadDocumentKeywords: async () => [],
        },
        fetchImpl,
        stortingetLimit: 0,
      },
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.results.some((r) => r.sourceType === 'web'));
      assert.equal(result.webSearchAttempted, true);
    }
  } finally {
    if (prevWeb === undefined) {
      delete process.env.WEB_SEARCH_URL;
    } else {
      process.env.WEB_SEARCH_URL = prevWeb;
    }
  }
}

void run().then(() => {
  console.log('lib/sources/find-more-sources.test.ts: ok');
});