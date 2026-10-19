import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

/** Payload 3.91 auth fields on users (replaces custom login_attempts / lock_until). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload"."users"
      ADD COLUMN IF NOT EXISTS "reset_password_requested_at" timestamp(3) with time zone;
    ALTER TABLE "payload"."users"
      DROP COLUMN IF EXISTS "login_attempts",
      DROP COLUMN IF EXISTS "lock_until";
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload"."users"
      DROP COLUMN IF EXISTS "reset_password_requested_at";
    ALTER TABLE "payload"."users"
      ADD COLUMN IF NOT EXISTS "login_attempts" numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "lock_until" timestamp(3) with time zone;
  `);
}
