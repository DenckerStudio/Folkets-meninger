import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

const adminForslag = read('app/dashboard/admin/forslag/admin-forslag-client.tsx');
const changelog = read('components/admin/app-future/changelog-admin-panel.tsx');
const roadmap = read('components/admin/app-future/roadmap-admin-panel.tsx');

assert.doesNotMatch(adminForslag, /onError=\{\(\) => \{\}\}/);
assert.match(adminForslag, /Prøv igjen/);
assert.match(adminForslag, /setChangelogPanelError/);
assert.match(adminForslag, /setRoadmapPanelError/);
assert.match(adminForslag, /changelogLoadError/);
assert.match(adminForslag, /roadmapLoadError/);

assert.match(changelog, /aria-label=\{`Rediger «\$\{entry\.title\}»`\}/);
assert.match(changelog, /Publisering feilet/);
assert.match(changelog, /Innlegget er avpublisert og lagret som utkast/);
assert.match(changelog, /loadFailed/);

assert.match(roadmap, /persistOrder\(next, \{ title: moved\.title, direction \}\)/);
assert.doesNotMatch(
  roadmap,
  /setReorderMessage\(`«\$\{moved\.title\}» flyttet[\s\S]*?\);\s*\n\s*persistOrder/,
);
assert.match(roadmap, /Rekkefølge feilet/);
assert.match(roadmap, /requestCloseSheet/);
assert.match(roadmap, /Lukke uten å lagre/);

console.log('app-future-admin-panels.test.ts: ok');
