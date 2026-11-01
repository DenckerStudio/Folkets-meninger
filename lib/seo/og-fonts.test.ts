import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadOgFonts } from './og-fonts';

test('loadOgFonts loads latin and latin-ext for 400 and 700', async () => {
  const fonts = await loadOgFonts();
  assert.equal(fonts.length, 4);
  const weights = fonts.map((face) => face.weight).sort();
  assert.deepEqual(weights, [400, 400, 700, 700]);
  for (const face of fonts) {
    assert.ok(face.data.byteLength > 10_000, `expected non-empty font ${face.weight}`);
  }
});
