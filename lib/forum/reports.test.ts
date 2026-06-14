import assert from 'node:assert/strict';
import {
  isDuplicateReportError,
  isValidReportCategory,
} from './reports';

assert.equal(isDuplicateReportError('23505'), true);
assert.equal(isDuplicateReportError('42P01'), false);
assert.equal(isValidReportCategory('spam'), true);
assert.equal(isValidReportCategory('invalid'), false);

console.log('forum reports tests passed');
