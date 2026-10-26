import assert from 'node:assert/strict';
import { isRegenerationOnRejectAvailable } from '@/lib/content-feedback/capabilities';

const missingRpc = {
  async rpc(name: string) {
    assert.equal(name, 'admin_submit_content_feedback');
    return { data: null, error: { code: 'PGRST202' } };
  },
};

const presentRpc = {
  async rpc(name: string) {
    assert.equal(name, 'admin_submit_content_feedback');
    return { data: null, error: { code: '22023', message: 'invalid content type' } };
  },
};

async function main() {
  assert.equal(await isRegenerationOnRejectAvailable(missingRpc), false);
  assert.equal(await isRegenerationOnRejectAvailable(presentRpc), true);
  console.log('content-feedback/capabilities.test.ts: ok');
}

void main();
