import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261101130000_create_share_link.sql'),
  'utf-8',
);

function extractFunction(name: string): string {
  const re = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${name}[\\s\\S]*?\\$function\\$;`,
    'i',
  );
  const match = migration.match(re);
  assert.ok(match, `missing function ${name}`);
  return match[0];
}

const functions = ['create_share_link', 'list_my_share_links'];

for (const name of functions) {
  const body = extractFunction(name);
  assert.match(body, /assert_rpc_caller_is_user/, `${name} must bind the caller`);
  assert.match(body, /pg_temp/, `${name} search_path must end with pg_temp`);
  assert.match(
    migration,
    new RegExp(
      `REVOKE ALL ON FUNCTION public\\.${name}[\\s\\S]*?FROM PUBLIC, anon, authenticated`,
      'i',
    ),
    `${name} must revoke PUBLIC, anon, authenticated`,
  );
  assert.match(
    migration,
    new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}[\\s\\S]*?TO service_role`, 'i'),
    `${name} must grant execute to service_role`,
  );
  assert.doesNotMatch(
    migration,
    new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}[\\s\\S]*TO authenticated`, 'i'),
    `${name} must not grant authenticated`,
  );
}

const createShareLink = extractFunction('create_share_link');
assert.match(createShareLink, /position\('\.\.' IN v_target_id\)/);
assert.match(
  createShareLink,
  /WHEN unique_violation THEN[\s\S]*revoked_at IS NULL[\s\S]*RETURN jsonb_build_object/,
);
assert.match(
  migration,
  /CREATE UNIQUE INDEX IF NOT EXISTS share_links_active_target_uidx[\s\S]*WHERE revoked_at IS NULL/i,
);

console.log('lib/analytics/create-share-link-migration.test.ts: ok');
