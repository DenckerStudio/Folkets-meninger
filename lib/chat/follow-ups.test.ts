import assert from 'node:assert/strict';
import { buildFollowUps } from './follow-ups';

async function main() {
  const noIssue = buildFollowUps({ hasIssue: false });
  assert.equal(noIssue.length, 3);
  assert.ok(noIssue.every((u) => u.id && u.label && u.prompt));

  const withIssue = buildFollowUps({ hasIssue: true, issueTitle: 'Strømpriser' });
  assert.equal(withIssue.length, 3);
  const ids = withIssue.map((u) => u.id);
  assert.ok(ids.includes('stemmer'));
  assert.ok(ids.includes('konsekvenser'));
  assert.match(withIssue.find((u) => u.id === 'stemmer')!.prompt, /Strømpriser/);

  // Already fetched votes -> do not suggest the same question twice.
  const afterVotes = buildFollowUps({
    hasIssue: true,
    issueTitle: 'Strømpriser',
    toolsUsed: ['tool-getVoteResults'],
  });
  assert.ok(!afterVotes.some((u) => u.id === 'stemmer'));

  // Sources already used -> dropped.
  const afterSources = buildFollowUps({
    hasIssue: true,
    issueTitle: 'Strømpriser',
    toolsUsed: ['tool-searchUpdatedSources'],
  });
  assert.ok(!afterSources.some((u) => u.id === 'kilder'));

  // No title -> subject falls back to "saken" without crashing.
  const untitled = buildFollowUps({ hasIssue: true });
  assert.match(untitled.find((u) => u.id === 'konsekvenser')!.prompt, /saken/);

  // Vote follow-up only fits sak-like pages.
  const onPolitician = buildFollowUps({
    hasIssue: true,
    issueTitle: 'Strømpriser',
    contextKind: 'politiker',
  });
  assert.ok(!onPolitician.some((u) => u.id === 'stemmer'));
  assert.ok(!onPolitician.some((u) => /offentlig profil/i.test(u.label)));

  const onSak = buildFollowUps({
    hasIssue: true,
    issueTitle: 'Strømpriser',
    contextKind: 'sak',
  });
  assert.ok(onSak.some((u) => u.id === 'stemmer'));

  console.log('chat/follow-ups.test.ts: ok');
}

void main();
