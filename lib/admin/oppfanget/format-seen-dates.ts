/** Normaliser first/last slik at «Først» alltid er eldste observasjon. */
export function normalizeSeenAtRange(firstSeenAt: string, lastSeenAt: string): {
  firstSeenAt: string;
  lastSeenAt: string;
} {
  const firstMs = Date.parse(firstSeenAt);
  const lastMs = Date.parse(lastSeenAt);
  if (Number.isNaN(firstMs) || Number.isNaN(lastMs)) {
    return { firstSeenAt, lastSeenAt };
  }
  if (firstMs <= lastMs) {
    return { firstSeenAt, lastSeenAt };
  }
  return { firstSeenAt: lastSeenAt, lastSeenAt: firstSeenAt };
}
