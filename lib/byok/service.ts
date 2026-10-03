import { getServiceSupabase } from '@/lib/supabase';
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

export function byokStorageReady(): boolean {
  return isByokEncryptionConfigured();
}

export async function getByokMeta(userId: string): Promise<ByokCredentialMeta | null> {
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('user_llm_credentials')
    .select('provider, model, base_url, key_last4, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    provider: data.provider as LlmProvider,
    model: data.model,
    baseUrl: data.base_url,
    keyLast4: data.key_last4,
    updatedAt: data.updated_at,
  };
}

export async function loadDecryptedByok(
  userId: string,
): Promise<DecryptedByokCredential | null> {
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('user_llm_credentials')
    .select('provider, model, base_url, ciphertext_b64, iv_b64, auth_tag_b64, key_last4, updated_at')
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
    provider: row.provider as LlmProvider,
    model: row.model,
    baseUrl: row.base_url,
    keyLast4: row.key_last4,
    updatedAt: row.updated_at,
    apiKey,
  };
}

export async function saveByokCredential(args: {
  userId: string;
  provider: LlmProvider;
  model: string;
  apiKey: string;
  baseUrl: string | null;
}): Promise<ByokCredentialMeta> {
  const encrypted = encryptSecret(args.apiKey.trim());
  const last4 = keyLast4(args.apiKey);
  const service = getServiceSupabase();
  const now = new Date().toISOString();

  const { data, error } = await service
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
    .select('provider, model, base_url, key_last4, updated_at')
    .single();

  if (error || !data) {
    throw new Error('Kunne ikke lagre nøkkelen');
  }

  return {
    provider: data.provider as LlmProvider,
    model: data.model,
    baseUrl: data.base_url,
    keyLast4: data.key_last4,
    updatedAt: data.updated_at,
  };
}

export async function deleteByokCredential(userId: string): Promise<void> {
  const service = getServiceSupabase();
  const { error } = await service.from('user_llm_credentials').delete().eq('user_id', userId);
  if (error) {
    throw new Error('Kunne ikke slette nøkkelen');
  }
}
