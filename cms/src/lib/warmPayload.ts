import { getPayload } from 'payload';
import config from '@payload-config';

let initPromise: Promise<void> | null = null;

/** Idempotent: connects Payload once per server process (migrations + onInit seed). */
export function ensurePayloadReady(): Promise<void> {
  if (!initPromise) {
    initPromise = getPayload({ config, cron: true }).then(() => undefined);
  }
  return initPromise;
}
