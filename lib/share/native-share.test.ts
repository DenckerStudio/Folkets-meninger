import assert from 'node:assert/strict';
import {
  canUseNativeShare,
  isShareAbortError,
  tryNativeShare,
  type NativeShareResult,
} from '@/lib/share/native-share';

assert.equal(canUseNativeShare(), false, 'no navigator in node');

assert.equal(isShareAbortError(new DOMException('User cancelled', 'AbortError')), true);
assert.equal(isShareAbortError(new Error('nope')), false);

const savedNavigator = globalThis.navigator;

async function withMockShare(
  impl: () => Promise<void>,
  run: () => Promise<NativeShareResult>,
): Promise<NativeShareResult> {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { share: impl },
  });
  try {
    return await run();
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: savedNavigator,
    });
  }
}

const input = {
  title: 'Tittel',
  text: 'Tekst',
  url: '/dashboard/utforsk',
};

const aborted = await withMockShare(
  async () => {
    throw new DOMException('Share canceled', 'AbortError');
  },
  () => tryNativeShare(input),
);
assert.equal(aborted, 'aborted', 'AbortError must not fall through as failure');

const shared = await withMockShare(
  async () => {},
  () => tryNativeShare(input),
);
assert.equal(shared, 'shared', 'successful share');

const failed = await withMockShare(
  async () => {
    throw new Error('network');
  },
  () => tryNativeShare(input),
);
assert.equal(failed, 'failed', 'non-abort errors are failed');

console.log('native share: ok');
