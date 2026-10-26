/** Split chat-style answers into body and optional «Kilder:» footer (unchanged by refusal polish). */
export function splitAnswerBodyAndSourcesFooter(text: string): { body: string; footer: string } {
  const lines = text.split('\n');
  const kilderIdx = lines.findIndex((line) => /^Kilder:\s*$/i.test(line.trim()));
  if (kilderIdx < 0) {
    return { body: text, footer: '' };
  }
  return {
    body: lines.slice(0, kilderIdx).join('\n'),
    footer: lines.slice(kilderIdx).join('\n'),
  };
}

export function joinAnswerBodyAndSourcesFooter(body: string, footer: string): string {
  const trimmedBody = body.trimEnd();
  if (!footer) return trimmedBody.trim();
  return `${trimmedBody}\n\n${footer}`;
}
