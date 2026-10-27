import assert from 'node:assert/strict';
import { isRegenerationOnRejectAvailable } from '@/lib/content-feedback/capabilities';
import { getServiceSupabase } from '@/lib/supabase';

type RpcProbeClient = Pick<ReturnType<typeof getServiceSupabase>, 'rpc'>;

const missingRpc = {
  async rpc(name: string) {
    assert.equal(name, 'admin_submit_content_feedback');
    return { data: null, error: { code: 'PGRST202' } };
  },
};

const validationErrorRpc = {
  async rpc(name: string) {
    assert.equal(name, 'admin_submit_content_feedback');
    return { data: null, error: { code: '22023', message: 'invalid content type' } };
  },
};

const successRpc = {
  async rpc(name: string) {
    assert.equal(name, 'admin_submit_content_feedback');
    return { data: '00000000-0000-4000-8000-000000000099', error: null };
  },
};

async function main() {
  assert.equal(await isRegenerationOnRejectAvailable(missingRpc as unknown as RpcProbeClient), false);
  assert.equal(await isRegenerationOnRejectAvailable(validationErrorRpc as unknown as RpcProbeClient), false);
  assert.equal(await isRegenerationOnRejectAvailable(successRpc as unknown as RpcProbeClient), true);
  console.log('content-feedback/capabilities.test.ts: ok');
}

void main();
