import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const checkbox = readFileSync(join(process.cwd(), 'components/ui/checkbox.tsx'), 'utf-8');

assert.doesNotMatch(checkbox, /min-h-11 min-w-11[\s\S]*<button/);
assert.match(checkbox, /size-6[\s\S]*max-sm:size-11/);
assert.match(checkbox, /role="checkbox"[\s\S]*size-6/);
assert.match(checkbox, /size-4 items-center justify-center rounded-\[4px\]/);

const select = readFileSync(join(process.cwd(), 'components/ui/select.tsx'), 'utf-8');
assert.match(select, /wrapperClassName/);

console.log('components/ui/checkbox-select-primitives.test.ts: ok');
