export type SaksgangStepLike = {
  navn: string;
  events: ReadonlyArray<{ id?: string; label: string | null; date: string | null }>;
};

/** Hendelser som avslutter et steg hos Stortinget (referert, innstilling avgitt). */
const STEP_COMPLETION_EVENT_IDS: ReadonlySet<string> = new Set(['REFS', 'AVGITT', 'INNST']);

function stepHasMeaningfulEvents(step: SaksgangStepLike): boolean {
  return step.events.some((e) => e.label || e.date);
}

function stepIsCompleted(step: SaksgangStepLike): boolean {
  return step.events.some((e) => e.id != null && STEP_COMPLETION_EVENT_IDS.has(e.id));
}

/**
 * Indeksen til steget som pågår nå, til «Nå»-merket og statuskortet.
 * Returnerer -1 når saken er ferdigbehandlet: da er alle steg gjennomført.
 */
export function resolveCurrentSaksgangStepIndex(
  steps: ReadonlyArray<SaksgangStepLike>,
  ferdigbehandlet: boolean,
): number {
  if (steps.length === 0) return 0;
  if (ferdigbehandlet) return -1;

  let lastReached = -1;
  for (let i = 0; i < steps.length; i += 1) {
    if (stepHasMeaningfulEvents(steps[i])) lastReached = i;
  }
  if (lastReached < 0) return 0;
  if (lastReached < steps.length - 1 && stepIsCompleted(steps[lastReached])) return lastReached + 1;
  return lastReached;
}

export function resolveCurrentSaksgangStepName(
  steps: ReadonlyArray<SaksgangStepLike>,
  ferdigbehandlet: boolean,
): string | null {
  const index = resolveCurrentSaksgangStepIndex(steps, ferdigbehandlet);
  if (index < 0) return null;
  return steps[index]?.navn?.trim() || null;
}
