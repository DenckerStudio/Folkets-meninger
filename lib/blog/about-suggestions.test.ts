import assert from 'node:assert/strict';
import { findForbiddenAboutTerms } from '@/lib/blog/about-draft';
import {
  buildChangelogSuggestions,
  buildCoverageSuggestions,
  buildInternalAboutSuggestions,
  buildRoadmapSuggestions,
  withEvergreenFallback,
  type AboutWrittenPiece,
} from '@/lib/blog/about-suggestions';
import { OM_FAQ, OM_INTRO } from '@/lib/landing/om-content';

function piece(title: string, kind: AboutWrittenPiece['kind'] = 'publisert'): AboutWrittenPiece {
  return { title, kind, at: '2026-11-01T00:00:00.000Z' };
}

function joined(suggestions: { title: string; angle: string; reason: string }[]): string {
  return suggestions.map((item) => `${item.title}\n${item.angle}\n${item.reason}`).join('\n');
}

function testCoverageGaps() {
  const open = buildCoverageSuggestions([]);
  const keys = open.map((item) => item.key);
  assert.ok(keys.includes('dekning:faq:representativitet'));
  assert.ok(keys.includes('dekning:faq:finansiering'));
  assert.ok(keys.includes('dekning:gratis'));
  assert.ok(keys.includes('dekning:stemme-pluss'));
  assert.equal(
    open.find((item) => item.key === 'dekning:faq:representativitet')?.title,
    OM_FAQ.find((entry) => entry.id === 'representativitet')?.question,
  );
  assert.deepEqual(findForbiddenAboutTerms(joined(open)), []);

  const covered = buildCoverageSuggestions([
    piece('Er tallene representative for hele Norge?'),
    piece('Hvordan finansieres tjenesten'),
    piece('Er appen nøytral'),
    piece('Hvem står bak prosjektet'),
    piece('Hva som er gratis'),
    piece('Dette følger med Stemme+'),
  ]);
  const coveredKeys = covered.map((item) => item.key);
  assert.ok(!coveredKeys.includes('dekning:faq:representativitet'));
  assert.ok(!coveredKeys.includes('dekning:faq:finansiering'));
  assert.ok(!coveredKeys.includes('dekning:gratis'));
  assert.ok(!coveredKeys.includes('dekning:stemme-pluss'));
  assert.ok(coveredKeys.includes('dekning:prosess:utforsk'));
  assert.ok(coveredKeys.includes('dekning:prosess:horinger'));
}

function testDedupeAgainstExistingTitles() {
  const suggestions = buildInternalAboutSuggestions({
    written: [
      piece('Bedre varsler i appen', 'utkast'),
      piece('Varsler for hjertesaker'),
    ],
    changelog: [
      { id: '1', title: 'Bedre varsler i appen', published: true },
      { id: '2', title: 'Tydeligere høringstekst', published: true },
      { id: '3', title: 'Bedre varsler i Stemme+', published: false },
      { id: '4', title: 'Logg inn med BankID', published: true },
    ],
    roadmap: [{ id: 'r1', title: 'Ryddigere saksside', status: 'planned' }],
  });

  assert.ok(!suggestions.some((item) => item.key === 'endringslogg:1'));
  assert.ok(!suggestions.some((item) => item.title.toLowerCase().includes('bankid')));

  const hearing = suggestions.find((item) => item.key === 'endringslogg:2');
  assert.ok(hearing);
  assert.equal(hearing?.source, 'endringslogg');
  assert.match(hearing?.reason ?? '', /Endringsloggen har «Tydeligere høringstekst»/);

  const partial = suggestions.find((item) => item.key === 'endringslogg:3');
  assert.ok(partial);
  assert.match(partial?.reason ?? '', /upublisert/);
  assert.equal(partial?.related?.title, 'Bedre varsler i appen');
  assert.equal(partial?.related?.kind, 'utkast');

  const roadmap = suggestions.find((item) => item.key === 'veikart:r1');
  assert.ok(roadmap);
  assert.match(roadmap?.reason ?? '', /status Planlagt/);
  assert.match(roadmap?.angle ?? '', /ikke lov punktet som en ferdig funksjon/);
  assert.deepEqual(findForbiddenAboutTerms(joined(suggestions)), []);
}

function testRoadmapDoneDoesNotPromise() {
  const [done] = buildRoadmapSuggestions(
    [{ id: 'r2', title: 'Ferdig varsling', status: 'done' }],
    [],
  );
  assert.ok(done);
  assert.match(done?.reason ?? '', /status Ferdig/);
  assert.match(done?.angle ?? '', /ikke finn opp tall eller funksjoner/);
}

function testEvergreenFallback() {
  const live = buildCoverageSuggestions([]);
  assert.ok(withEvergreenFallback(live).every((item) => item.evergreen === false));

  const standing = withEvergreenFallback([], [piece('Er tallene representative for hele Norge?')]);
  assert.ok(standing.length > 0);
  assert.ok(standing.every((item) => item.source === 'staende' && item.evergreen));
  assert.match(standing.map((item) => item.angle).join('\n'), new RegExp(OM_INTRO.slice(0, 40)));
  assert.ok(standing.some((item) => item.key === 'staende:hva-tjenesten-er'));
  assert.deepEqual(findForbiddenAboutTerms(joined(standing)), []);
}

testCoverageGaps();
testDedupeAgainstExistingTitles();
testRoadmapDoneDoesNotPromise();
testEvergreenFallback();
console.log('lib/blog/about-suggestions.test.ts ok');
