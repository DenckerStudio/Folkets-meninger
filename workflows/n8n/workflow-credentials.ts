import { newCredential } from '@n8n/workflow-sdk';

/** Shared Supabase API credential for Folkets Stemme n8n workflows. */
export const folketsSupabaseCredential = {
  supabaseApi: newCredential('Folkets-meninger'),
};
