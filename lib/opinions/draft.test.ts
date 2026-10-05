import assert from 'node:assert/strict';
import {
  clearOpinionComposerDraft,
  hasOpinionComposerDraftContent,
  opinionDraftStorageKey,
  parseOpinionComposerDraft,
  readOpinionComposerDraft,
  resolveOpinionComposerDraft,
  writeOpinionComposerDraft,
  type OpinionComposerDraft,
  type OpinionDraftStorage,
} from './draft';
import { emptyOpinionPointDrafts } from './validate';

class MemoryStorage implements OpinionDraftStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

const signedOutKey = opinionDraftStorageKey(null);
const userKey = opinionDraftStorageKey('user-a');
const otherKey = opinionDraftStorageKey('user-b');
assert.notEqual(signedOutKey, userKey);
assert.notEqual(userKey, otherKey);
assert.equal(opinionDraftStorageKey(''), signedOutKey);
assert.equal(opinionDraftStorageKey(undefined), signedOutKey);
assert.match(userKey, /user-a/);
assert.doesNotMatch(signedOutKey, /user-a/);

const draft: OpinionComposerDraft = {
  title: 'Kollektiv i distriktene',
  issueId: 'sak-1',
  stance: 'for',
  body: 'En halvferdig begrunnelse',
  points: [
    { stance: 'for', text: 'Bedre kollektiv gir flere reisende.' },
    { stance: 'imot', text: '' },
    { stance: 'for', text: '' },
  ],
};

assert.equal(hasOpinionComposerDraftContent({
  title: '',
  issueId: null,
  stance: null,
  body: '',
  points: emptyOpinionPointDrafts(),
}), false);

assert.equal(hasOpinionComposerDraftContent({
  ...draft,
  title: '',
  issueId: null,
  stance: null,
  body: '',
  points: [
    { stance: 'imot', text: '' },
    { stance: 'imot', text: '' },
    { stance: 'for', text: '' },
  ],
}), true);

const storage = new MemoryStorage();
writeOpinionComposerDraft(storage, null, draft);
writeOpinionComposerDraft(storage, 'user-a', { ...draft, title: 'Bare for A' });
assert.equal(readOpinionComposerDraft(storage, 'user-b'), null);
assert.equal(readOpinionComposerDraft(storage, null)?.title, draft.title);
assert.equal(readOpinionComposerDraft(storage, 'user-a')?.title, 'Bare for A');

clearOpinionComposerDraft(storage, 'user-a');
assert.equal(readOpinionComposerDraft(storage, 'user-a'), null);
assert.equal(readOpinionComposerDraft(storage, null)?.title, draft.title);

assert.equal(resolveOpinionComposerDraft(true, draft), null);
assert.equal(resolveOpinionComposerDraft(false, draft)?.issueId, 'sak-1');
assert.equal(resolveOpinionComposerDraft(false, null), null);

const parsed = parseOpinionComposerDraft({
  title: 'Tittel',
  issueId: '  ',
  stance: 'imot',
  body: 'tekst',
  points: [
    { stance: 'for', text: 'p'.repeat(300) },
    { stance: 'imot', text: 'imot-punkt her' },
  ],
});
assert.ok(parsed);
assert.equal(parsed?.issueId, null);
assert.equal(parsed?.points.length, 3);
assert.equal(parsed?.points[0]?.text.length, 280);
assert.equal(parseOpinionComposerDraft({ title: 'T', body: 'b', stance: 'blank', issueId: null, points: draft.points }), null);
assert.equal(readOpinionComposerDraft(new MemoryStorage(), null), null);

storage.setItem(signedOutKey, '{');
assert.equal(readOpinionComposerDraft(storage, null), null);

console.log('opinions/draft.test.ts: ok');
