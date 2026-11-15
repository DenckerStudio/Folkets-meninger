/** When true, Utforsk should keep today's client-side lexical filter. */
export function shouldFallbackUtforskToLexicalSearch(hybridIssueIds: string[] | null): boolean {
  return hybridIssueIds === null;
}