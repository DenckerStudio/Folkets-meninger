export type SaksgangStepLike = {
  navn: string;
  events: ReadonlyArray<{ label: string | null; date: string | null }>;
};

function stepHasMeaningfulEvents(step: SaksgangStepLike): boolean {
  return step.events.some((e) => e.label || e.date);
}

/** Shared index for timeline «Nå»-merke og status (én kilde). */
export function resolveCurrentSaksgangStepIndex(
  steps: ReadonlyArray<SaksgangStepLike>,
  ferdigbehandlet: boolean,
): number {
  if (steps.length === 0) return 0;
  let lastDone = -1;
  for (let i = 0; i < steps.length; i += 1) {
    if (stepHasMeaningfulEvents(steps[i])) lastDone = i;
  }
  if (ferdigbehandlet) return lastDone >= 0 ? lastDone : steps.length - 1;
  if (lastDone >= 0 && lastDone < steps.length - 1) return lastDone + 1;
  return lastDone >= 0 ? lastDone : 0;
}

export function resolveCurrentSaksgangStepName(
  steps: ReadonlyArray<SaksgangStepLike>,
  ferdigbehandlet: boolean,
): string | null {
  if (steps.length === 0) return null;
  const index = resolveCurrentSaksgangStepIndex(steps, ferdigbehandlet);
  return steps[index]?.navn?.trim() || null;
}