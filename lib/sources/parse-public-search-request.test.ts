import assert from 'node:assert/strict';
import { parsePublicSearchRequestBody } from './parse-public-search-request';

const empty = parsePublicSearchRequestBody(null);
assert.equal(empty.ok, true);

const emptyObj = parsePublicSearchRequestBody({});
assert.equal(emptyObj.ok, true);

const qReject = parsePublicSearchRequestBody({ q: 'skatt' });
assert.equal(qReject.ok, false);
if (!qReject.ok) {
  assert.match(qReject.message, /søketekst/i);
}

const queryReject = parsePublicSearchRequestBody({ query: 'hemmelig notat' });
assert.equal(queryReject.ok, false);

const titleReject = parsePublicSearchRequestBody({ title: 'research_topics.title' });
assert.equal(titleReject.ok, false);

const extraKey = parsePublicSearchRequestBody({ topic_id: '00000000-0000-4000-8000-000000000001' });
assert.equal(extraKey.ok, false);
if (!extraKey.ok) {
  assert.match(extraKey.message, /URL/);
}

console.log('lib/sources/parse-public-search-request.test.ts: ok');