import assert from 'node:assert/strict';
import {
  formatSensitiveCategoryLabel,
  formatSensitiveTemaCell,
} from '@/lib/admin/oppfanget/sensitive-category';

assert.equal(formatSensitiveCategoryLabel('veldedig_boikott'), 'veldedig boikott');
assert.equal(formatSensitiveTemaCell(true, 'veldedig_boikott'), 'veldedig boikott');
assert.equal(formatSensitiveTemaCell(false, null), 'Nei');

console.log('admin/oppfanget/sensitive-category.test.ts: ok');
