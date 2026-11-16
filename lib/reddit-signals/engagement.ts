/**
 * Sammenlignbar «engasjement»-score for sortering og vekst.
 * Formel: poeng + 2×kommentarer + 5×kryssposter (mangler kryssposter telles som 0).
 */
export function computeRedditSignalEngagement(
  score: number,
  numComments: number,
  numCrossposts: number | null | undefined,
): number {
  const cross = numCrossposts ?? 0;
  return score + 2 * numComments + 5 * cross;
}