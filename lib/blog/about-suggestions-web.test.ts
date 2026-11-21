import assert from 'node:assert/strict';
import {
  buildWebAboutSuggestions,
  isOwnFolketsDomain,
  isRedditWebHit,
  keepExternalWebHits,
  type AboutWebHit,
} from '@/lib/blog/about-suggestions-web';

const ownBlog: AboutWebHit = {
  title: 'Vår blogg',
  url: 'https://www.folkets-meninger.no/blogg/om-oss',
  snippet: 'Vi har 999 brukere på forsiden.',
};

const ownCms: AboutWebHit = {
  title: 'CMS',
  url: 'https://cms.folkets-meninger.no/admin',
  snippet: 'Internt utkast.',
};

const retired: AboutWebHit = {
  title: 'Gammelt navn',
  url: 'https://folkets-stemme.no/om',
  snippet: 'Folkets Stemme hadde 50 brukere.',
};

const reddit: AboutWebHit = {
  title: 'Folkets Meninger har 100000 brukere',
  url: 'https://www.reddit.com/r/norge/comments/abc',
  snippet: 'De har 100000 brukere sier innlegget.',
};

const nrk: AboutWebHit = {
  title: 'Ny omtale av avstemninger',
  url: 'https://www.nrk.no/norge/folkets-meninger-1',
  snippet: 'Saken handler om avstemninger og siterer et tall.',
};

function testOwnDomainDropped() {
  assert.equal(isOwnFolketsDomain(ownBlog.url), true);
  assert.equal(isOwnFolketsDomain(ownCms.url), true);
  assert.equal(isOwnFolketsDomain(nrk.url), false);
  assert.equal(isRedditWebHit(reddit.url), true);

  const kept = keepExternalWebHits([ownBlog, ownCms, retired, reddit, nrk, nrk]);
  assert.deepEqual(
    kept.map((hit) => hit.url),
    [reddit.url, nrk.url],
  );
}

function testRedditIsNotFact() {
  const suggestions = buildWebAboutSuggestions([ownBlog, ownCms, retired, reddit, nrk], []);
  const packed = JSON.stringify(suggestions);
  assert.doesNotMatch(packed, /100000|999 brukere|50 brukere|sier innlegget|Folkets Stemme|folkets-stemme/);
  assert.ok(!suggestions.some((item) => item.provenance.mentionUrl?.includes('folkets-meninger.no')));
  assert.ok(!suggestions.some((item) => item.provenance.mentionUrl?.includes('folkets-stemme.no')));

  const discussion = suggestions.find((item) => item.provenance.interestOnly === true);
  assert.ok(discussion);
  assert.equal(discussion?.source, 'nett');
  assert.match(discussion?.reason ?? '', /interessesignal/);
  assert.doesNotMatch(`${discussion?.title} ${discussion?.angle} ${discussion?.reason}`, /100000|brukere sier/);

  const article = suggestions.find((item) => item.provenance.mentionUrl === nrk.url);
  assert.ok(article);
  assert.equal(article?.provenance.interestOnly, false);
  assert.match(article?.reason ?? '', /Noen skriver om hvordan avstemningene virker/);
  assert.doesNotMatch(`${article?.title}\n${article?.angle}\n${article?.reason}`, /Ny omtale|siterer et tall/);

  assert.deepEqual(buildWebAboutSuggestions([ownBlog], []), []);
}

testOwnDomainDropped();
testRedditIsNotFact();
console.log('lib/blog/about-suggestions-web.test.ts ok');
