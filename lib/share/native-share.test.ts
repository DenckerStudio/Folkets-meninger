import assert from 'node:assert/strict';
import { canUseNativeShare } from '@/lib/share/native-share';

assert.equal(canUseNativeShare(), false, 'no navigator in node');

console.log('native share: ok');
