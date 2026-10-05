import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

const reelsStage = read('components/polls/utforsk-reels-stage.tsx');
assert.match(reelsStage, /from '@\/components\/motion\/empty-line'/);
assert.match(reelsStage, /Ingen Reels publisert ennå/);
assert.match(reelsStage, /SYSTEM_REEL_DISCLAIMER/);
assert.match(reelsStage, /ja\/nei\/blank/);
assert.match(reelsStage, /EmptyLineState/);
assert.doesNotMatch(reelsStage, /border-dashed border-border bg-card px-6 py-12/);

const adminForslag = read('app/dashboard/admin/forslag/admin-forslag-client.tsx');
assert.match(adminForslag, /from '@\/components\/dashboard\/empty-state'/);
assert.match(adminForslag, /Ingen forslag i denne listen ennå/);
assert.match(adminForslag, /Ingen endringslogg ennå/);
assert.doesNotMatch(
  adminForslag,
  /rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground/,
);

const adminBrukere = read('app/dashboard/admin/brukere/admin-brukere-client.tsx');
assert.match(adminBrukere, /from '@\/components\/dashboard\/empty-state'/);
assert.match(adminBrukere, /Ingen administratorer funnet/);

const stemmePlusPage = read('app/dashboard/admin/stemme-plus/page.tsx');
assert.doesNotMatch(stemmePlusPage, /DashboardPage/);
assert.match(stemmePlusPage, /StemmePlusAdmin/);

const chatPage = read('app/dashboard/chat/page.tsx');
assert.match(chatPage, /redirect\(`\$\{routes\.utforsk\}\?\$\{chatDeepLinkQuery\(sak\)\}`\)/);

const orbCss = read('components/chat/chat-orb.css');
assert.match(orbCss, /z-index:\s*80/);
const chatPanel = read('components/chat/chat-panel.tsx');
assert.match(chatPanel, /z-\[90\]/);
assert.match(chatPanel, /STATUS_LOAD_TIMEOUT_MS/);
assert.match(chatPanel, /guestGate\(\)/);

console.log('dashboard/empty-state-surfaces.test.ts: ok Reels + admin empties + chat redirect');
