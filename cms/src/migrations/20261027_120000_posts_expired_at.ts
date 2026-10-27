import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

/** Soft-expiry timestamp for blog drafts awaiting review (fm-web ops job). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload"."posts"
      ADD COLUMN IF NOT EXISTS "expired_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "restored_at" timestamp(3) with time zone;

    ALTER TABLE "payload"."_posts_v"
      ADD COLUMN IF NOT EXISTS "version_expired_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "version_restored_at" timestamp(3) with time zone;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload"."posts"
      DROP COLUMN IF EXISTS "expired_at",
      DROP COLUMN IF EXISTS "restored_at";

    ALTER TABLE "payload"."_posts_v"
      DROP COLUMN IF EXISTS "version_expired_at",
      DROP COLUMN IF EXISTS "version_restored_at";
  `);
}
