import assert from 'node:assert/strict';
import test from 'node:test';

/** Mirrors display rules in MinSideOverviewPanel StatGrid. */
function stemmerSumLabel(
  stance: { status: 'ok'; value: number } | { status: 'unavailable' },
  polls: { status: 'ok'; value: number } | { status: 'unavailable' },
): string {
  if (stance.status === 'ok' && polls.status === 'ok') {
    return String(stance.value + polls.value);
  }
  if (stance.status === 'ok') return String(stance.value);
  if (polls.status === 'ok') return String(polls.value);
  return '–';
}

test('overview stats use dash when a count is unavailable', () => {
  assert.equal(stemmerSumLabel({ status: 'unavailable' }, { status: 'unavailable' }), '–');
  assert.equal(stemmerSumLabel({ status: 'ok', value: 3 }, { status: 'unavailable' }), '3');
  assert.equal(stemmerSumLabel({ status: 'ok', value: 2 }, { status: 'ok', value: 4 }), '6');
});