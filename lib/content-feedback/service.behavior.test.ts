import assert from 'node:assert/strict';
import {
  CONTENT_FEEDBACK_FALLBACK_REGENERATION_HINT,
  submitAdminContentFeedbackRpc,
} from '@/lib/content-feedback/service';

const adminId = '00000000-0000-4000-8000-000000000001';
const rejectBody = {
  content_type: 'ai_summary' as const,
  content_id: '12345',
  verdict: 'reject' as const,
  aspects: { title: '-' },
  reason_tags: [] as string[],
  note: null,
};

let rpcCalls: string[] = [];
const supabase = {
  async rpc(name: string) {
    rpcCalls.push(name);
    if (name === 'admin_submit_content_feedback') {
      return { data: null, error: { code: 'PGRST202' } };
    }
    if (name === 'upsert_content_feedback') {
      return { data: 'fb-id', error: null };
    }
    throw new Error(`Unexpected rpc ${name}`);
  },
};

async function main() {
  const fallbackResult = await submitAdminContentFeedbackRpc(adminId, rejectBody, {
    supabase,
    buildSnapshot: async () => ({}),
  });
  assert.deepEqual(rpcCalls, ['admin_submit_content_feedback', 'upsert_content_feedback']);
  assert.equal(fallbackResult.regeneration, false);
  assert.equal(fallbackResult.regeneration_hint, CONTENT_FEEDBACK_FALLBACK_REGENERATION_HINT);

  rpcCalls = [];
  const primarySupabase = {
    async rpc(name: string) {
      rpcCalls.push(name);
      if (name === 'admin_submit_content_feedback') {
        return { data: 'fb-primary', error: null };
      }
      throw new Error(`Unexpected rpc ${name}`);
    },
  };

  const primaryResult = await submitAdminContentFeedbackRpc(adminId, rejectBody, {
    supabase: primarySupabase,
    buildSnapshot: async () => ({}),
  });
  assert.deepEqual(rpcCalls, ['admin_submit_content_feedback']);
  assert.equal(primaryResult.regeneration, true);
  assert.equal(primaryResult.regeneration_hint, undefined);

  console.log('content-feedback/service.behavior.test.ts: ok');
}

void main();
