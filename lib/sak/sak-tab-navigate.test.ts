import assert from 'node:assert/strict';
import { SAK_TAB_NAVIGATE_EVENT, navigateToSakTab } from '@/lib/sak/sak-tab-navigate';

type WindowLike = {
  dispatchEvent: (event: { type: string; detail?: { tabId: string } }) => boolean;
  addEventListener: (type: string, handler: (event: { detail?: { tabId: string } }) => void) => void;
  removeEventListener: (type: string, handler: (event: { detail?: { tabId: string } }) => void) => void;
};

const globalRef = globalThis as unknown as { window?: WindowLike };
const previousWindow = globalRef.window;

let lastTab: string | null = null;
const handler = (event: { detail?: { tabId: string } }) => {
  lastTab = event.detail?.tabId ?? null;
};

globalRef.window = {
  dispatchEvent(event) {
    if (event.type === SAK_TAB_NAVIGATE_EVENT) handler(event);
    return true;
  },
  addEventListener(type, fn) {
    if (type === SAK_TAB_NAVIGATE_EVENT) {
      (globalThis as { __sakTabHandler?: typeof handler }).__sakTabHandler = fn;
    }
  },
  removeEventListener() {},
};

navigateToSakTab('dokumenter');
assert.equal(lastTab, 'dokumenter');

if (previousWindow === undefined) {
  delete globalRef.window;
} else {
  globalRef.window = previousWindow;
}

console.log('lib/sak/sak-tab-navigate.test.ts: ok');