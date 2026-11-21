import assert from 'node:assert/strict';
import { ABOUT_BLOG_CATEGORY_SLUG } from '@/lib/blog/about-draft';
import {
  ABOUT_RESEARCH_DRAFT_CATEGORY,
  buildResearchAboutSuggestions,
  type AboutResearchSignal,
} from '@/lib/blog/about-suggestions-research';

function signal(overrides: Partial<AboutResearchSignal> & Pick<AboutResearchSignal, 'actionName'>): AboutResearchSignal {
  return {
    clusterId: 'c1',
    topicId: null,
    sourceKind: 'cluster',
    topic: null,
    description: '',
    target: null,
    ...overrides,
  };
}

function testProductFilter() {
  const suggestions = buildResearchAboutSuggestions([
    signal({
      clusterId: 'c-rema',
      actionName: 'Boykott av dagligvare',
      topic: 'matpriser',
      description: 'Opprop mot høye priser i butikk',
      target: 'Rema',
    }),
    signal({
      clusterId: 'c-demo',
      topicId: 't-1',
      actionName: 'Digitalt demokrati',
      topic: 'visning',
      description: 'Kampanje om hvordan meninger vises i avstemninger',
    }),
    signal({
      clusterId: null,
      topicId: 't-reddit',
      sourceKind: 'reddit',
      actionName: 'Påstått brukerhopp',
      description: 'Folkets Meninger har 100000 brukere ifølge tråden',
    }),
  ]);

  assert.ok(!suggestions.some((item) => item.provenance.clusterId === 'c-rema'));
  assert.doesNotMatch(JSON.stringify(suggestions), /Rema|dagligvare|100000|Påstått|tråden/);

  const product = suggestions.find((item) => item.provenance.clusterId === 'c-demo');
  assert.ok(product);
  assert.equal(product?.source, 'research');
  assert.equal(product?.provenance.topicId, 't-1');
  assert.equal(product?.provenance.interestOnly, false);
  assert.match(product?.reason ?? '', /ikke et forskningsnotat/);
  assert.doesNotMatch(product?.angle ?? '', /Kampanje/);
  assert.doesNotMatch(product?.title ?? '', /Digitalt demokrati i Folkets Meninger/);

  const reddit = suggestions.find((item) => item.provenance.topicId === 't-reddit');
  assert.ok(reddit);
  assert.equal(reddit?.provenance.interestOnly, true);
  assert.match(reddit?.reason ?? '', /interessesignal/);
  assert.doesNotMatch(reddit?.reason ?? '', /100000|brukere/);

  assert.equal(ABOUT_RESEARCH_DRAFT_CATEGORY, ABOUT_BLOG_CATEGORY_SLUG);
  assert.equal(ABOUT_RESEARCH_DRAFT_CATEGORY, 'om-folkets-meninger');
  assert.ok(suggestions.every((item) => item.source === 'research'));
}

testProductFilter();
console.log('lib/blog/about-suggestions-research.test.ts ok');
