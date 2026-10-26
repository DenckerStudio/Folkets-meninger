import type { ResolvedEndpoint } from './endpoints';
import type { EndpointHealth } from './endpoint-health';

/** Exit 0 only when the sole primary endpoint passed preflight. */
export function primaryPreflightPassed(
  endpoints: ResolvedEndpoint[],
  healthByName: Map<string, EndpointHealth>,
): boolean {
  const primary = endpoints.find((e) => e.primary);
  if (!primary) return false;
  return healthByName.get(primary.name)?.preflightOk === true;
}
