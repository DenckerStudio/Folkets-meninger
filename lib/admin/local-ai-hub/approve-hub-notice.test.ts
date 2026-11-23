import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildApproveHubNotice,
  parseStoredHubNotice,
  readHubNoticeFromStorage,
  serializeHubNotice,
  writeHubNoticeToStorage,
  LOCAL_AI_HUB_NOTICE_STORAGE_KEY,
} from '@/lib/admin/local-ai-hub/approve-hub-notice';
import { approveSuccessAfterPrReady } from '@/lib/admin/local-ai-hub/approve-pr-ready';

const pull = {
  number: 333,
  url: 'https://github.com/DenckerStudio/Folkets-meninger/pull/333',
};

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    key() {
      return null;
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

describe('buildApproveHubNotice', () => {
  it('gir suksessmelding med PR-nummer', () => {
    const notice = buildApproveHubNotice(46, { ok: true, pull });
    assert.equal(notice?.variant, 'success');
    assert.match(notice?.body ?? '', /PR #333 satt til ready/);
  });

  it('skiller ready-feil fra kommentar-feil', () => {
    const readyFail = buildApproveHubNotice(46, {
      ok: false,
      readyFailed: true,
      pull,
      error: 'boom',
    });
    assert.equal(readyFail?.variant, 'warning');
    assert.match(readyFail?.body ?? '', /kunne ikke settes til ready/i);
    assert.equal(readyFail?.canRetryReady, true);

    const commentFail = buildApproveHubNotice(46, { ok: true, pull, commentFailed: true });
    assert.equal(commentFail?.variant, 'warning');
    assert.match(commentFail?.body ?? '', /er satt til ready/i);
    assert.doesNotMatch(commentFail?.body ?? '', /kunne ikke settes til ready/i);
    assert.equal(commentFail?.canRetryReady, false);
  });
});

describe('hub-notice sessionStorage', () => {
  it('overlever lagring og lesing (som etter refresh)', () => {
    const storage = memoryStorage();
    const original = buildApproveHubNotice(46, {
      ok: false,
      readyFailed: true,
      pull,
      error: 'nett',
    });
    assert.ok(original);
    writeHubNoticeToStorage(storage, original);
    const roundtrip = readHubNoticeFromStorage(storage);
    assert.deepEqual(roundtrip, original);
    assert.equal(storage.getItem(LOCAL_AI_HUB_NOTICE_STORAGE_KEY), serializeHubNotice(original));
    assert.equal(parseStoredHubNotice('not-json'), null);
  });
});

describe('approveSuccessAfterPrReady', () => {
  it('returnerer hubNotice for ready-feil', () => {
    const res = approveSuccessAfterPrReady(46, {
      ok: false,
      readyFailed: true,
      pull,
      error: 'x',
    });
    assert.equal(res.ok, true);
    assert.equal(res.hubNotice?.variant, 'warning');
    assert.match(res.hubNotice?.body ?? '', /manuelt/i);
  });
});