import type { Payload } from 'payload';

const FAILED_JOB_RETENTION_DAYS = 30;

/** Remove terminal failed jobs so `hasError` rows do not grow without bound. */
export async function pruneFailedPayloadJobs(payload: Payload): Promise<void> {
  const cutoff = new Date(
    Date.now() - FAILED_JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  await payload.delete({
    collection: 'payload-jobs',
    where: {
      and: [
        { hasError: { equals: true } },
        { updatedAt: { less_than: cutoff } },
      ],
    },
    overrideAccess: true,
  });
}
