import assert from 'node:assert/strict';
import { isOppfangetMockPreviewAllowed } from '@/lib/admin/oppfanget/preview';

const originalNodeEnv = process.env.NODE_ENV;
const originalVercelEnv = process.env.VERCEL_ENV;

function withEnv(nodeEnv: string, vercelEnv: string | undefined, fn: () => void) {
  process.env.NODE_ENV = nodeEnv;
  if (vercelEnv === undefined) {
    delete process.env.VERCEL_ENV;
  } else {
    process.env.VERCEL_ENV = vercelEnv;
  }
  try {
    fn();
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
  }
}

withEnv('development', undefined, () => {
  assert.equal(isOppfangetMockPreviewAllowed('mock'), true);
  assert.equal(isOppfangetMockPreviewAllowed(null), false);
});

withEnv('production', 'production', () => {
  assert.equal(isOppfangetMockPreviewAllowed('mock'), false);
});

console.log('admin/oppfanget/preview.test.ts: ok');
