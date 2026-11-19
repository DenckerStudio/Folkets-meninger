import assert from 'node:assert/strict';
import {
  HOMEPAGE_DOCUMENT_TITLE,
  HOMEPAGE_OG_HEADLINE,
  HOW_IT_WORKS_STEPS,
  HOW_IT_WORKS_TITLE,
  LANDING_BENEFITS_LINES,
  LANDING_BENEFITS_TITLE,
  LANDING_CTA_SUBTITLE,
  LANDING_CTA_TITLE,
  LANDING_FOOTER_TAGLINE,
  LANDING_HERO_CARD_COPY,
  LANDING_HERO_H1_LINE_2,
  LANDING_HERO_PRIMARY_CTA,
  LANDING_HERO_SUBHEAD,
} from '@/lib/landing/homepage-copy';
import { splitHighlightPhrase } from '@/lib/landing/highlight-phrase';

const copyBlob = [
  HOMEPAGE_DOCUMENT_TITLE,
  HOMEPAGE_OG_HEADLINE,
  HOW_IT_WORKS_TITLE,
  LANDING_BENEFITS_TITLE,
  LANDING_CTA_TITLE,
  LANDING_CTA_SUBTITLE,
  LANDING_FOOTER_TAGLINE,
  LANDING_HERO_CARD_COPY,
  LANDING_HERO_H1_LINE_2,
  LANDING_HERO_PRIMARY_CTA,
  LANDING_HERO_SUBHEAD,
  ...HOW_IT_WORKS_STEPS.flatMap((step) => [step.title, step.description]),
  ...LANDING_BENEFITS_LINES.map((line) => line.text),
].join('\n');

assert.doesNotMatch(copyBlob, /din stemme/i);
assert.doesNotMatch(copyBlob, /stemmen din/i);
assert.doesNotMatch(copyBlob, /Stem mellom valgene/);
assert.match(HOW_IT_WORKS_TITLE, /Fra din mening til Stortinget/);
assert.match(LANDING_HERO_H1_LINE_2, /Din mening mellom valgene/);

for (const line of LANDING_BENEFITS_LINES) {
  assert.ok(splitHighlightPhrase(line.text, line.highlight), `missing highlight in: ${line.text}`);
}

console.log('landing/homepage-copy.test.ts: ok');
