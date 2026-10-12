import assert from 'node:assert/strict';
import {
  buildOpinionInnspillPackage,
  canPackageOpinionInnspill,
  opinionInnspillPackageToMarkdown,
} from './package';
import { innspillStatusLabel, type OpinionInnspillRecord } from './types';

function record(overrides: Partial<OpinionInnspillRecord> = {}): OpinionInnspillRecord {
  return {
    opinionId: '11111111-1111-1111-1111-111111111111',
    authorUserId: '22222222-2222-2222-2222-222222222222',
    authorName: 'Ola Nordmann',
    status: 'gathering',
    supportThreshold: 10,
    supportCount: 0,
    stortingetHearingId: null,
    hearingDeadlineAt: null,
    packagedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const opinion = {
  title: 'Begrens parkeringsavgiften',
  body: 'Avgiften har økt kraftig de siste årene.',
  points: [
    { stance: 'for' as const, text: 'Avgiften er uforholdsmessig i sentrum.' },
    { stance: 'imot' as const, text: 'Inntekten går til grønn omstilling.' },
  ],
};

function testPackageShape() {
  const pkg = buildOpinionInnspillPackage({
    innspill: record({ supportCount: 4 }),
    opinion,
    sakId: '999',
    sakTitle: 'Parkeringsavgift',
    hearing: {
      id: 'h1',
      title: 'Høring om parkering',
      komite: 'Kommunal- og forvaltningskomiteen',
      deadlineAt: '2026-03-01T00:00:00.000Z',
      deadlineLabel: '1. mars 2026',
      open: true,
    },
    generatedAt: '2026-02-01T10:00:00.000Z',
  });

  assert.equal(pkg.kind, 'motforslag_horingsinnspill');
  assert.equal(pkg.sak.id, '999');
  assert.equal(pkg.sak.title, 'Parkeringsavgift');
  assert.equal(pkg.hearing.id, 'h1');
  assert.equal(pkg.hearing.komite, 'Kommunal- og forvaltningskomiteen');
  assert.equal(pkg.proposal.id, record().opinionId);
  assert.equal(pkg.proposal.supportCount, 4);
  assert.equal(pkg.proposal.supportThreshold, 10);
  assert.equal(pkg.proposal.authorName, 'Ola Nordmann');
  assert.equal(pkg.proposal.points.length, 2);
  assert.ok(pkg.disclaimer.includes('stortinget.no'));
}

function testMarkdownIncludesPoints() {
  const pkg = buildOpinionInnspillPackage({
    innspill: record({ supportCount: 12, status: 'threshold_met' }),
    opinion,
    sakId: '999',
    sakTitle: 'Parkeringsavgift',
    generatedAt: '2026-02-01T10:00:00.000Z',
  });

  const markdown = opinionInnspillPackageToMarkdown(pkg);
  assert.ok(markdown.includes('# Motforslag til sak 999'));
  assert.ok(markdown.includes('Begrens parkeringsavgiften'));
  assert.ok(markdown.includes('**Støtte:** 12 av 10'));
  assert.ok(markdown.includes('### Argumenter'));
  assert.ok(markdown.includes('**For:** Avgiften er uforholdsmessig i sentrum.'));
  assert.ok(markdown.includes('**Imot:** Inntekten går til grønn omstilling.'));
  assert.ok(markdown.includes(pkg.disclaimer));
}

function testMarkdownWithoutPoints() {
  const pkg = buildOpinionInnspillPackage({
    innspill: record(),
    opinion: { ...opinion, points: [] },
    sakId: '1',
    sakTitle: 'Sak',
  });
  const markdown = opinionInnspillPackageToMarkdown(pkg);
  assert.ok(!markdown.includes('### Argumenter'));
  assert.ok(markdown.includes(pkg.disclaimer));
}

function testCanPackage() {
  assert.equal(canPackageOpinionInnspill(record({ supportCount: 10 })), true);
  assert.equal(canPackageOpinionInnspill(record({ supportCount: 9 })), false);
  assert.equal(
    canPackageOpinionInnspill(record({ supportCount: 50, status: 'withdrawn' })),
    false,
  );
  // Already packaged inputs are never repackaged.
  assert.equal(
    canPackageOpinionInnspill(record({ supportCount: 50, status: 'packaged' })),
    false,
  );
}

function testStatusLabels() {
  assert.equal(innspillStatusLabel('gathering'), 'Samler støtte');
  assert.equal(innspillStatusLabel('threshold_met'), 'Terskel nådd');
  assert.equal(innspillStatusLabel('packaged'), 'Pakket som innspill');
  assert.equal(innspillStatusLabel('withdrawn'), 'Trukket');
}

testPackageShape();
testMarkdownIncludesPoints();
testMarkdownWithoutPoints();
testCanPackage();
testStatusLabels();

console.log('opinion innspill package tests passed');
