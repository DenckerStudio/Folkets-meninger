import assert from 'node:assert/strict';
import {
  CONTENT_FEEDBACK_FALLBACK_REGENERATION_HINT,
  submitAdminContentFeedbackRpc,
} from '@/lib/content-feedback/service';
import type { AdminContentFeedbackBody } from '@/lib/content-feedback/validation';
import { getServiceSupabase } from '@/lib/supabase';

const adminId = '00000000-0000-4000-8000-000000000001';
const rejectBody: AdminContentFeedbackBody = {
  content_type: 'ai_summary',
  content_id: '12345',
  verdict: 'reject',
  aspects: { title: '-' },
  reason_tags: [],
  note: null,
};

type ContentFeedbackRpcClient = Pick<ReturnType<typeof getServiceSupabase>, 'rpc'>;

const snapshotPayload = { title: 'Sammendrag' };

type RpcCall = { name: string; args: Record<string, unknown> };

function makeRpcRecorder(
  handlers: Record<string, (args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>>,
) {
  const calls: RpcCall[] = [];
  const supabase = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      const handler = handlers[name];
      if (!handler) {
        throw new Error(`Unexpected rpc ${name}`);
      }
      return handler(args);
    },
  };
  return { supabase: supabase as unknown as ContentFeedbackRpcClient, calls };
}

async function main() {
  const fallbackRecorder = makeRpcRecorder({
    admin_submit_content_feedback: async () => ({ data: null, error: { code: 'PGRST202' } }),
    upsert_content_feedback: async () => ({ data: 'fb-id', error: null }),
  });

  const fallbackResult = await submitAdminContentFeedbackRpc(adminId, rejectBody, {
    supabase: fallbackRecorder.supabase,
    buildSnapshot: async () => snapshotPayload,
  });
  assert.deepEqual(
    fallbackRecorder.calls.map((call) => call.name),
    ['admin_submit_content_feedback', 'upsert_content_feedback'],
  );
  assert.deepEqual(fallbackRecorder.calls[0].args, fallbackRecorder.calls[1].args);
  assert.equal(fallbackResult.regeneration, false);
  assert.equal(fallbackResult.regeneration_hint, CONTENT_FEEDBACK_FALLBACK_REGENERATION_HINT);

  const primaryRecorder = makeRpcRecorder({
    admin_submit_content_feedback: async () => ({ data: 'fb-primary', error: null }),
  });

  const primaryResult = await submitAdminContentFeedbackRpc(adminId, rejectBody, {
    supabase: primaryRecorder.supabase,
    buildSnapshot: async () => snapshotPayload,
  });
  assert.deepEqual(primaryRecorder.calls.map((call) => call.name), [
    'admin_submit_content_feedback',
  ]);
  assert.equal(primaryResult.regeneration, true);
  assert.equal(primaryResult.regeneration_hint, undefined);

  for (const primaryError of [
    { code: '42501', message: 'permission denied' },
    { code: 'PGRST301', message: 'JWT expired' },
    new Error('network down'),
  ]) {
    let upsertTouched = false;
    const rejecting = makeRpcRecorder({
      admin_submit_content_feedback: async () => ({ data: null, error: primaryError }),
      upsert_content_feedback: async () => {
        upsertTouched = true;
        return { data: 'nope', error: null };
      },
    });
    await assert.rejects(
      () =>
        submitAdminContentFeedbackRpc(adminId, rejectBody, {
          supabase: rejecting.supabase,
          buildSnapshot: async () => snapshotPayload,
        }),
    );
    assert.equal(upsertTouched, false);
  }

  const upsertFails = makeRpcRecorder({
    admin_submit_content_feedback: async () => ({ data: null, error: { code: 'PGRST202' } }),
    upsert_content_feedback: async () => ({
      data: null,
      error: { code: '23505', message: 'duplicate' },
    }),
  });
  await assert.rejects(
    () =>
      submitAdminContentFeedbackRpc(adminId, rejectBody, {
        supabase: upsertFails.supabase,
        buildSnapshot: async () => snapshotPayload,
      }),
  );

  console.log('content-feedback/service.behavior.test.ts: ok');
}

void main();
