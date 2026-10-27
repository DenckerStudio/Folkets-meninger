/** Width percent for one stories progress segment (past / current / upcoming). */
export function segmentProgressPercent(
  index: number,
  currentIndex: number,
  progress: number,
  autoPlay: boolean
): number {
  if (index < currentIndex) return 100;
  if (index > currentIndex) return 0;
  return autoPlay ? progress : 100;
}
