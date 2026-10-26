import assert from 'node:assert/strict';
import { getBloggSecondaryAction } from '@/lib/blog/blogg-secondary-action';
import { routes } from '@/lib/routes';

assert.deepEqual(getBloggSecondaryAction('/blogg'), {
  href: routes.home,
  label: 'Til forsiden',
});
assert.deepEqual(getBloggSecondaryAction('/blogg/side/2'), {
  href: routes.home,
  label: 'Til forsiden',
});
assert.deepEqual(getBloggSecondaryAction('/blogg/side/2/'), {
  href: routes.home,
  label: 'Til forsiden',
});
assert.deepEqual(getBloggSecondaryAction('/blogg/min-artikkel'), {
  href: routes.blogg,
  label: 'Til bloggforsiden',
});
assert.deepEqual(getBloggSecondaryAction('/blogg/tema/stortinget'), {
  href: routes.blogg,
  label: 'Til bloggforsiden',
});

console.log('blogg-secondary-action.test.ts: ok');
