export function formatBlogReviewState(state: string | null | undefined): string | null {
  if (!state) return null;
  switch (state) {
    case 'til_vurdering':
      return 'Til vurdering';
    case 'ny':
      return 'Ny';
    case 'godkjent':
      return 'Godkjent';
    case 'avvist':
      return 'Avvist';
    default:
      return state;
  }
}
