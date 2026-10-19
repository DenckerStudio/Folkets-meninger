import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

const shell = read('components/polls/reel-expanded-shell.tsx');
const voteCard = read('components/polls/reel-vote-card.tsx');

assert.match(shell, /wasOpenRef/);
assert.match(shell, /if \(!wasOpenRef\.current\) return/);
assert.doesNotMatch(shell, /if \(open\) return;\s*const el = returnFocusRef/s);

assert.match(voteCard, /onCollapseExpand/);
assert.match(voteCard, /mode="expanded"[\s\S]*onCollapseExpand/);

assert.match(shell, /<h2 id=\{titleId\}/);
assert.doesNotMatch(shell, /<p id=\{titleId\}/);

console.log('reel-focus tests passed');
