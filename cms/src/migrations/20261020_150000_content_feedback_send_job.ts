import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "payload"."enum_payload_jobs_task_slug" ADD VALUE IF NOT EXISTS 'contentFeedbackSend';
  `);
  await db.execute(sql`
    ALTER TYPE "payload"."enum_payload_jobs_log_task_slug" ADD VALUE IF NOT EXISTS 'contentFeedbackSend';
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Postgres cannot remove enum values safely; leave task slug in place on rollback.
}
