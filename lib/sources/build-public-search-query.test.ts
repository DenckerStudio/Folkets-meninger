import assert from 'node:assert/strict';
import { buildPublicSearchQuery, composePublicSearchQuery } from './build-public-search-query';

const composed = composePublicSearchQuery(['Formueskatt', 'formueskatt', 'Stortinget']);
assert.equal(composed, 'Formueskatt Stortinget');

async function run() {
  const issueOk = await buildPublicSearchQuery(
    { kind: 'issue', issueId: '103102' },
    {
      loadIssue: async () => ({
        id: '103102',
        title: 'Endringer i pensjonstrygden for fiskere',
        henvisning: 'Prop. 133 L',
      }),
      loadTopic: async () => null,
      loadDocumentKeywords: async () => ['Innstilling'],
    },
  );
  assert.equal(issueOk.ok, true);
  if (issueOk.ok) {
    assert.match(issueOk.query, /pensjonstrygden/i);
    assert.doesNotMatch(issueOk.query, /admin-hemmelig/i);
  }

  const topicOk = await buildPublicSearchQuery(
    { kind: 'topic', topicId: 't1' },
    {
      loadTopic: async () => ({
        stortinget_issue_id: '103102',
        output: {
          topic_title: 'Formueskatt',
          current_rules: { items: ['Eksisterende regler for formueskatt'], note: '…' },
          party_proposals: { items: [], note: 'ingen funnet' },
          media_coverage: { items: [], note: 'ingen funnet' },
          polls: { items: [], note: 'ingen funnet' },
          sources: { items: [], note: 'ingen funnet' },
        },
      }),
      loadIssue: async () => ({
        id: '103102',
        title: 'Sak om formueskatt',
        henvisning: null,
      }),
      loadDocumentKeywords: async () => [],
    },
  );
  assert.equal(topicOk.ok, true);
  if (topicOk.ok) {
    assert.match(topicOk.query, /Formueskatt/i);
  }

  const missing = await buildPublicSearchQuery(
    { kind: 'topic', topicId: 'missing' },
    {
      loadTopic: async () => null,
      loadIssue: async () => null,
      loadDocumentKeywords: async () => [],
    },
  );
  assert.equal(missing.ok, false);
}

void run().then(() => {
  console.log('lib/sources/build-public-search-query.test.ts: ok');
});