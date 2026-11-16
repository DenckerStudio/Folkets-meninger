import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ballotShouldShowDistribution } from '@/lib/polls/ballot-distribution-layout';
import { isSakKnowledgeQuizEnabled } from '@/lib/sak/flags';

const root = process.cwd();
const pageSrc = readFileSync(join(root, 'app/dashboard/sak/[id]/page.tsx'), 'utf8');
const stickySrc = readFileSync(join(root, 'components/sak/sak-sticky-poll-line.tsx'), 'utf8');
const slotSrc = readFileSync(join(root, 'components/sak/sak-open-poll-sticky-slot.tsx'), 'utf8');

assert.match(pageSrc, /SakOpenPollStickySlot/, 'saksside monterer sticky slot');
assert.match(pageSrc, /!openStortingetPoll/, 'aggregering skjules når avstemning er åpen');
assert.doesNotMatch(pageSrc, /StortingetPollAdminSection/, 'admin avstemning fjernet fra saksside');
assert.match(pageSrc, /isSakKnowledgeQuizEnabled/, 'kunnskapstest bak flagg');
assert.doesNotMatch(pageSrc, /NEXT_PUBLIC_SAK_KNOWLEDGE_QUIZ/, 'ikke hardkodet env i page');

assert.match(stickySrc, /PollBallot/, 'gjenbruker poll-ballot');
assert.match(stickySrc, /compact/, 'kompakt ballot i linjen');
assert.match(stickySrc, /safe-area-inset-bottom/, 'safe area på mobil');
assert.match(stickySrc, /fixed inset-x-0 bottom-0/, 'sticky nederst');
assert.match(stickySrc, /focus-visible|PollBallot/, 'fokus via ballot');

assert.match(slotSrc, /redactPollTotalsForViewer/, 'skjuling før stemme');
assert.match(slotSrc, /openPoll/, 'kun åpen avstemning');

const atK = { ja: 3, nei: 2, blank: 0, total: 5 };
assert.equal(ballotShouldShowDistribution(atK, true, false), false, 'fordeling skjult før stemme');
assert.equal(ballotShouldShowDistribution(atK, true, true), true, 'fordeling etter stemme');
assert.equal(ballotShouldShowDistribution(atK, false, false), true, 'fordeling når stengt');

const quizOff = process.env.NEXT_PUBLIC_SAK_KNOWLEDGE_QUIZ;
delete process.env.NEXT_PUBLIC_SAK_KNOWLEDGE_QUIZ;
assert.equal(isSakKnowledgeQuizEnabled(), false);
if (quizOff === undefined) delete process.env.NEXT_PUBLIC_SAK_KNOWLEDGE_QUIZ;
else process.env.NEXT_PUBLIC_SAK_KNOWLEDGE_QUIZ = quizOff;

console.log('lib/sak/sak-sticky-poll-line.test.ts: ok');