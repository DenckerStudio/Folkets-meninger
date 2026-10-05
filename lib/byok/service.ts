import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  decryptSecret,
  encryptSecret,
  isByokEncryptionConfigured,
  keyLast4,
} from '@/lib/byok/crypto';
import type { LlmProvider } from '@/lib/byok/providers';

export type ByokCredentialMeta = {
  provider: LlmProvider;
  model: string;
  baseUrl: string | null;
  keyLast4: string;
  updatedAt: string;
};

export type DecryptedByokCredential = ByokCredentialMeta & {
  apiKey: string;
};

export type ByokClient = Pick<SupabaseClient, 'from'>;

type CredentialRow = {
  provider: string;
  model: string;
  base_url: string | null;
  ciphertext_b64: string;
  iv_b64: string;
  auth_tag_b64: string;
  key_last4: string;
  updated_at: string;
};

const META_COLUMNS = 'provider, model, base_url, key_last4, updated_at';
const SECRET_COLUMNS =
  'provider, model, base_url, ciphertext_b64, iv_b64, auth_tag_b64, key_last4, updated_at';

export function byokStorageReady(): boolean {
  return isByokEncryptionConfigured();
}

async function byokClient(explicit?: ByokClient | null): Promise<ByokClient> {
  if (explicit) return explicit;
  return getServerSupabase();
}

function toMeta(row: {
  provider: string;
  model: string;
  base_url: string | null;
  key_last4: string;
  updated_at: string;
}): ByokCredentialMeta {
  return {
    provider: row.provider as LlmProvider,
    model: row.model,
    baseUrl: row.base_url,
    keyLast4: row.key_last4,
    updatedAt: row.updated_at,
  };
}

export async function getByokMeta(
  userId: string,
  client?: ByokClient | null,
): Promise<ByokCredentialMeta | null> {
  const supabase = await byokClient(client);
  const { data, error } = await supabase
    .from('user_llm_credentials')
    .select(META_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return toMeta(data);
}

export async function loadDecryptedByok(
  userId: string,
  client?: ByokClient | null,
): Promise<DecryptedByokCredential | null> {
  const supabase = await byokClient(client);
  const { data, error } = await supabase
    .from('user_llm_credentials')
    .select(SECRET_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as CredentialRow;
  const apiKey = decryptSecret({
    ciphertextB64: row.ciphertext_b64,
    ivB64: row.iv_b64,
    authTagB64: row.auth_tag_b64,
  });

  return {
    ...toMeta(row),
    apiKey,
  };
}

export async function saveByokCredential(args: {
  userId: string;
  provider: LlmProvider;
  model: string;
  apiKey: string;
  baseUrl: string | null;
  client?: ByokClient | null;
}): Promise<ByokCredentialMeta> {
  const encrypted = encryptSecret(args.apiKey.trim());
  const last4 = keyLast4(args.apiKey);
  const supabase = await byokClient(args.client);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('user_llm_credentials')
    .upsert(
      {
        user_id: args.userId,
        provider: args.provider,
        model: args.model,
        base_url: args.baseUrl,
        ciphertext_b64: encrypted.ciphertextB64,
        iv_b64: encrypted.ivB64,
        auth_tag_b64: encrypted.authTagB64,
        key_last4: last4,
        updated_at: now,
      },
      { onConflict: 'user_id' },
    )
    .select(META_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error('Kunne ikke lagre nøkkelen');
  }

  return toMeta(data);
}

export async function deleteByokCredential(
  userId: string,
  client?: ByokClient | null,
): Promise<void> {
  const supabase = await byokClient(client);
  const { error } = await supabase.from('user_llm_credentials').delete().eq('user_id', userId);
  if (error) {
    throw new Error('Kunne ikke slette nøkkelen');
  }
}
