import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

/**
 * Restore Payload account-lock columns dropped in 20261018_130000_payload_391_users_auth.
 * Required when users.auth.maxLoginAttempts > 0.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload"."users"
      ADD COLUMN IF NOT EXISTS "login_attempts" numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "lock_until" timestamp(3) with time zone;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload"."users"
      DROP COLUMN IF EXISTS "login_attempts",
      DROP COLUMN IF EXISTS "lock_until";
  `);
}
