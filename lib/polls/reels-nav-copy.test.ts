import assert from 'node:assert/strict';
import { reelsNavCopy } from '@/lib/polls/reels-nav-copy';

function subtitleStartsWithUppercaseLetter(subtitle: string): boolean {
  const trimmed = subtitle.trim();
  if (!trimmed) return false;
  const first = trimmed[0];
  return first !== first.toLocaleLowerCase('nb-NO');
}

const forwardWithItems = reelsNavCopy('forward', 3);
assert(
  forwardWithItems.subtitle.startsWith('Nei, blank eller ja på'),
  'forward nav subtitle uses sentence-start ballot phrase',
);
assert(
  subtitleStartsWithUppercaseLetter(forwardWithItems.subtitle),
  'forward nav subtitle with items starts with uppercase',
);

const forwardEmpty = reelsNavCopy('forward', 0);
assert(
  subtitleStartsWithUppercaseLetter(forwardEmpty.subtitle),
  'forward nav empty subtitle starts with uppercase',
);

const back = reelsNavCopy('back', 0);
assert(
  subtitleStartsWithUppercaseLetter(back.subtitle),
  'back nav subtitle starts with uppercase',
);

console.log('lib/polls/reels-nav-copy.test.ts: ok');
