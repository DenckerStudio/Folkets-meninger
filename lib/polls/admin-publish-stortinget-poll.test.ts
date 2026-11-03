import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminPublishStortingetPoll } from '@/lib/polls/service';

const pollId = '00000000-0000-4000-8000-000000000042';
let capturedArgs: Record<string, unknown> | null = null;

const service = {
  async rpc(name: string, args: Record<string, unknown>) {
    assert.equal(name, 'admin_publish_stortinget_poll');
    capturedArgs = args;
    return { data: pollId, error: null };
  },
} as unknown as Pick<SupabaseClient, 'rpc'>;

async function main() {
  const returned = await adminPublishStortingetPoll(
    {
      issueId: '12345',
      title: 'Avstemningstittel',
      neutralSummary: 'Nøytralt sammendrag',
      sourceUrls: [{ url: 'https://www.stortinget.no', label: 'Stortinget' }],
      closesAt: '2030-01-01T12:00:00.000Z',
      clearClosesAt: false,
    },
    service,
  );

  assert.equal(returned, pollId);
  assert.deepEqual(capturedArgs, {
    p_issue_id: '12345',
    p_title: 'Avstemningstittel',
    p_neutral_summary: 'Nøytralt sammendrag',
    p_source_urls: [{ url: 'https://www.stortinget.no', label: 'Stortinget' }],
    p_closes_at: '2030-01-01T12:00:00.000Z',
    p_clear_closes_at: false,
  });

  console.log('admin-publish-stortinget-poll.test.ts: ok');
}

void main();
