import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CLOUD_ARTIFACTS = '/opt/cursor/artifacts';

/** Writes optional JSON evidence for live probes; works in CI and cloud-agent VMs. */
export function writeLiveTestArtifact(filename: string, payload: unknown): void {
  const dir =
    process.env.LIVE_TEST_ARTIFACT_DIR ??
    (existsSync(CLOUD_ARTIFACTS) ? CLOUD_ARTIFACTS : join(process.cwd(), '.test-artifacts'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), JSON.stringify(payload, null, 2));
}
