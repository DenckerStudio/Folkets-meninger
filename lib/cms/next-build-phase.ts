/** True while `next build` is collecting static page data / prerendering. */
export function isNextProductionBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}
