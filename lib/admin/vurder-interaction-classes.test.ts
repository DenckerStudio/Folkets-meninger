import { test } from 'node:test';
import assert from 'node:assert';
import { VURDER_FOCUS_RING } from './vurder-interaction-classes';

test('VURDER_FOCUS_RING exports the correct CSS class string', () => {
  assert.equal(
    VURDER_FOCUS_RING,
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
  );
});
