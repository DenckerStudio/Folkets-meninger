import assert from 'node:assert/strict';
import { getChatRagRpcClient } from '@/lib/chat/rag-rpc-client';

const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function restoreEnv(): void {
  if (savedUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
  if (savedKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
}

try {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.equal(getChatRagRpcClient(), null);

  process.env.NEXT_PUBLIC_SUPABASE_URL = '   ';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  assert.equal(getChatRagRpcClient(), null);

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '  \t  ';
  assert.equal(getChatRagRpcClient(), null);

  process.env.NEXT_PUBLIC_SUPABASE_URL = '  https://example.supabase.co  ';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '  key-with-padding  ';
  const client = getChatRagRpcClient();
  assert.ok(client);
} finally {
  restoreEnv();
}

console.log('chat/rag-rpc-client.test.ts: ok');
