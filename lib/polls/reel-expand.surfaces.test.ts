import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

const voteCard = read('components/polls/reel-vote-card.tsx');
const stage = read('components/polls/utforsk-reels-stage.tsx');
const shell = read('components/polls/reel-expanded-shell.tsx');

assert.doesNotMatch(voteCard, /items-end justify-center/);
assert.doesNotMatch(voteCard, /reel-description-sheet/);
assert.doesNotMatch(voteCard, /data-testid="reel-description"[\s\S]{0,120}overflow-y-auto/);
assert.match(voteCard, /line-clamp-4/);
assert.match(voteCard, /layoutId/);
assert.match(voteCard, /ReelExpandedShell/);
assert.match(voteCard, /Les mer/);

assert.match(stage, /expandedPollId/);
assert.match(stage, /LayoutGroup/);
assert.match(stage, /interactionLocked=\{cardOpen \|\| detailExpanded\}/);
assert.match(stage, /ReelsExpandPortalProvider/);

assert.match(shell, /role="dialog"/);
assert.match(shell, /aria-modal="true"/);
assert.match(shell, /useFocusTrap/);
assert.match(shell, /useBodyOverlayFlag\(open\)/);
assert.match(shell, /data-reels-expanded/);

assert.match(voteCard, /REEL_TEXT_HIT/);

console.log('reel-expand surfaces tests passed');
