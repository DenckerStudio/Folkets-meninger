export type ResearchAdminView = 'oppfanget' | 'signaler' | 'temaer';

export function parseResearchAdminView(
  input: Record<string, string | string[] | undefined>,
): ResearchAdminView {
  const raw = input.view;
  const view = typeof raw === 'string' ? raw : '';
  if (view === 'signaler') return 'signaler';
  if (view === 'temaer') return 'temaer';
  return 'oppfanget';
}

export function isRedditSignalsView(
  input: Record<string, string | string[] | undefined>,
): boolean {
  return parseResearchAdminView(input) === 'signaler';
}

export function isRedditTemaerView(
  input: Record<string, string | string[] | undefined>,
): boolean {
  return parseResearchAdminView(input) === 'temaer';
}