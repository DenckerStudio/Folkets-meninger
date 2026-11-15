import assert from 'node:assert/strict';
import {
  adminSavedSourcesFromBriefOutput,
  mergeBlogDraftSources,
} from '@/lib/blog/blog-draft-sources';
import { collectBlogDraftSources } from '@/lib/blog/blog-draft-sources';

const stortingetHit = {
  title: 'Stortinget-dokument',
  url: 'https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=103102',
  domain: 'stortinget.no',
  snippet: 'Utdrag',
  sourceType: 'stortinget' as const,
};

const nrkHit = {
  title: 'NRK sak',
  url: 'https://www.nrk.no/nyheter/sak-1',
  domain: 'nrk.no',
  snippet: 'Nett',
  sourceType: 'web' as const,
};

const duplicateNrk = {
  ...nrkHit,
  url: 'https://www.nrk.no/nyheter/sak-1/',
  title: 'NRK duplikat',
};

const redditHit = {
  title: 'Reddit',
  url: 'https://www.reddit.com/r/norge/comments/x',
  domain: 'reddit.com',
  snippet: '',
  sourceType: 'web' as const,
};

const merged = mergeBlogDraftSources({
  stortinget: [stortingetHit, stortingetHit],
  adminSaved: [nrkHit, duplicateNrk],
  web: [redditHit],
});

assert.equal(merged.some((row) => row.url.includes('reddit')), false);
assert.equal(merged.filter((row) => row.url.includes('nrk.no')).length, 1);
assert.ok(merged.length >= 2);
const domains = new Set(merged.map((row) => row.publisher));
assert.ok(domains.size >= 2);

const briefOutput = {
  topic_title: 'Formueskatt',
  current_rules: { items: [], note: 'ingen funnet' },
  party_proposals: { items: [], note: 'ingen funnet' },
  media_coverage: { items: [], note: 'ingen funnet' },
  polls: { items: [], note: 'ingen funnet' },
  sources: {
    items: [
      {
        id: 'a',
        title: 'Lagret kilde',
        url: 'https://www.nrk.no/lagret',
        publisher: 'nrk.no',
        grade: 'B',
      },
      {
        id: 'r',
        title: 'Reddit',
        url: 'https://www.reddit.com/r/norge/comments/x',
        publisher: 'reddit.com',
        grade: 'D',
      },
    ],
    note: 'ok',
  },
};

const adminHits = adminSavedSourcesFromBriefOutput(briefOutput);
assert.equal(adminHits.length, 1);
assert.match(adminHits[0]!.url, /nrk\.no/);

async function runCollect() {
  const prevWeb = process.env.WEB_SEARCH_URL;
  delete process.env.WEB_SEARCH_URL;

  const collected = await collectBlogDraftSources(
    { kind: 'issue', issueId: '103102' },
    {
      briefOutput,
      deps: {
        loadIssue: async () => ({
          id: '103102',
          title: 'Test sak om skatt',
          henvisning: 'Prop. 1',
        }),
        loadTopic: async () => null,
        loadDocumentKeywords: async () => [],
      },
      stortingetLimit: 0,
    },
  );

  assert.equal(collected.webSearchEnabled, false);
  assert.equal(collected.webSearchAttempted, false);
  assert.ok(collected.sources.length >= 1);
  assert.equal(
    collected.sources.some((row) => row.url.includes('reddit')),
    false,
  );

  if (prevWeb === undefined) delete process.env.WEB_SEARCH_URL;
  else process.env.WEB_SEARCH_URL = prevWeb;
}

void runCollect().then(() => {
  console.log('lib/blog/blog-draft-sources.test.ts ok');
});