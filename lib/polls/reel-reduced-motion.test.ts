import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

const shell = read('components/polls/reel-expanded-shell.tsx');
const voteCard = read('components/polls/reel-vote-card.tsx');
const stage = read('components/polls/utforsk-reels-stage.tsx');

assert.match(shell, /shareLayout = open && !isMobile && !reducedMotion/);
assert.match(shell, /layout=\{shareLayout\}/);
assert.match(shell, /mobileInitial = reducedMotion \? false : \{ opacity: 0 \}/);
assert.match(shell, /layout: \{ duration: 0 \}/);

assert.match(voteCard, /useSharedLayout = canExpand && !isExpandMobile && !reducedMotion/);
assert.match(voteCard, /layout=\{useSharedLayout\}/);

assert.match(stage, /detailExpanded && !reducedMotion && !isExpandMobile \? 0\.96 : 1/);

console.log('reel-reduced-motion tests passed');
