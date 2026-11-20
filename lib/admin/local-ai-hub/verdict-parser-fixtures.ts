/**
 * Verbatim førstelinjer fra Pixel/Friction på PR #314, #330–#334 (GitHub issue comments).
 */
export const PIXEL_VERDICT_FIXTURES = [
  {
    pr: 314,
    body: '**Pixel UI PASS @ e451abb23f38e43552823330d64bbcfc378c5a0c**',
    headSha: 'e451abb23f38e43552823330d64bbcfc378c5a0c',
    outcome: 'pass' as const,
  },
  {
    pr: 330,
    body: '**Pixel UI PASS @ 784d52949fe8d553bf6ae79345f358233311dd66**',
    headSha: '784d52949fe8d553bf6ae79345f358233311dd66',
    outcome: 'pass' as const,
  },
  {
    pr: 334,
    body: '**Pixel: UI PASS** @1d9fc111',
    headSha: '1d9fc111956738529598e7d5bd0edb2a1a268c0e',
    outcome: 'pass' as const,
  },
] as const;

export const FRICTION_VERDICT_FIXTURES = [
  {
    pr: 314,
    body: '**Friction UX: PASS @ `a04143ed36ce35675b5dd280d0cc38a9f154d7f7`**',
    headSha: 'a04143ed36ce35675b5dd280d0cc38a9f154d7f7',
    outcome: 'pass' as const,
  },
  {
    pr: 330,
    body: '**Friction UX: PASS @ `784d52949fe8d553bf6ae79345f358233311dd66`**',
    headSha: '784d52949fe8d553bf6ae79345f358233311dd66',
    outcome: 'pass' as const,
  },
  {
    pr: 334,
    body: '**Friction UX: FAIL @ `1d9fc111956738529598e7d5bd0edb2a1a268c0e`**',
    headSha: '1d9fc111956738529598e7d5bd0edb2a1a268c0e',
    outcome: 'fail' as const,
  },
] as const;