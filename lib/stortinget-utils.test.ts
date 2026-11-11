import assert from 'node:assert/strict';
import { stortingetUrl, parseStortingetDotNetDateToISO } from './stortinget-utils';

describe('stortingetUrl', () => {
  it('skips undefined values in the arguments', () => {
    const result = stortingetUrl('/test', { a: undefined, b: 'value' });
    assert.strictEqual(result, 'https://data.stortinget.no/test?b=value');
  });

  it('stringifies numbers', () => {
    const result = stortingetUrl('/test', { num: 123 });
    assert.strictEqual(result, 'https://data.stortinget.no/test?num=123');
  });

  it('stringifies booleans', () => {
    const result = stortingetUrl('/test', { bool: true });
    assert.strictEqual(result, 'https://data.stortinget.no/test?bool=true');
  });

  it('handles mixed valid and invalid inputs', () => {
    const result = stortingetUrl('/test', { a: undefined, num: 456, bool: false, str: 'value' });
    assert.strictEqual(result, 'https://data.stortinget.no/test?num=456&bool=false&str=value');
  });
});

describe('parseStortingetDotNetDateToISO', () => {
  it('converts "/Date(1700000000000+0100)/" to "2023-11-14"', () => {
    const result = parseStortingetDotNetDateToISO('/Date(1700000000000+0100)/');
    assert.strictEqual(result, '2023-11-14');
  });

  it('returns an empty string for an empty input', () => {
    const result = parseStortingetDotNetDateToISO('');
    assert.strictEqual(result, '');
  });

  it('returns the input unchanged for an unknown format', () => {
    const result = parseStortingetDotNetDateToISO('unknown');
    assert.strictEqual(result, 'unknown');
  });

  it('returns an empty string for an empty string input', () => {
    const result = parseStortingetDotNetDateToISO('');
    assert.strictEqual(result, '');
  });

  it('returns the input unchanged for an unknown format', () => {
    const result = parseStortingetDotNetDateToISO('unknown');
    assert.strictEqual(result, 'unknown');
  });
});
