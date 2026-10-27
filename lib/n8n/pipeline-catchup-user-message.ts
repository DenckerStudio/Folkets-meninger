export type PipelineCatchupTriggered = {
  health?: boolean;
  embeddingsIssuesTriggered?: number;
};

/** Admin UI copy after POST /api/admin/pipeline-health — only claims success when something ran. */
export function pipelineCatchupUserMessage(
  triggered: Partial<PipelineCatchupTriggered> | undefined,
): string {
  const health = Boolean(triggered?.health);
  const embeddingsTriggered = (triggered?.embeddingsIssuesTriggered ?? 0) > 0;
  if (health || embeddingsTriggered) {
    return 'Oppfrisking er startet. Køene oppdateres i bakgrunnen.';
  }
  return 'Ingen oppfrisking ble startet. Helsesjekken for pipelinen er ikke konfigurert i dette miljøet.';
}
