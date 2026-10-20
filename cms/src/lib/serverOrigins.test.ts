import assert from 'node:assert/strict';
import {
  resolveCmsServerUrl,
  resolveWebPublicUrl,
  trustedPayloadOrigins,
} from './serverOrigins';

assert.equal(resolveCmsServerUrl({}), 'http://localhost:3001');
assert.equal(
  resolveCmsServerUrl({ SERVER_URL: 'https://cms.folkets-meninger.no' }),
  'https://cms.folkets-meninger.no',
);
assert.equal(
  resolveCmsServerUrl({
    PAYLOAD_PUBLIC_SERVER_URL: 'https://cms.example.test',
  }),
  'https://cms.example.test',
);
assert.equal(
  resolveCmsServerUrl({
    SERVER_URL: 'https://cms.primary.test',
    PAYLOAD_PUBLIC_SERVER_URL: 'https://cms.fallback.test',
  }),
  'https://cms.primary.test',
);

assert.equal(resolveWebPublicUrl({}), 'http://localhost:3000');
assert.equal(
  resolveWebPublicUrl({ WEB_PUBLIC_URL: 'https://www.folkets-meninger.no' }),
  'https://www.folkets-meninger.no',
);

assert.deepEqual(
  trustedPayloadOrigins({
    SERVER_URL: 'https://cms.folkets-meninger.no',
    WEB_PUBLIC_URL: 'https://www.folkets-meninger.no',
  }),
  ['https://cms.folkets-meninger.no', 'https://www.folkets-meninger.no'],
);

console.log('cms/src/lib/serverOrigins.test.ts ok');
