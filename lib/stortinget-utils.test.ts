import assert from 'node:assert/strict';
import { stortingetUrl, parseStortingetDotNetDateToISO } from './stortinget-utils';

assert.strictEqual(stortingetUrl('/test', { a: undefined, b: 'value' }), 'https://data.stortinget.no/test?b=value');
assert.strictEqual(stortingetUrl('/test', { num: 123 }), 'https://data.stortinget.no/test?num=123');
assert.strictEqual(stortingetUrl('/test', { bool: true }), 'https://data.stortinget.no/test?bool=true');
assert.strictEqual(stortingetUrl('/test', { a: undefined, num: 456, bool: false, str: 'value' }), 'https://data.stortinget.no/test?num=456&bool=false&str=value');

assert.strictEqual(parseStortingetDotNetDateToISO('/Date(1700000000000+0100)/'), '2023-11-14');
assert.strictEqual(parseStortingetDotNetDateToISO(''), '');
assert.strictEqual(parseStortingetDotNetDateToISO('unknown'), 'unknown');
