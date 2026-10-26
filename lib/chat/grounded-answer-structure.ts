/** Split chat-style answers into body and optional «Kilder:» footer (unchanged by refusal polish). */
const KILDER_FOOTER_LINE_RE =
  /^(?:#{1,6}\s+)?(?:\*\*)?Kilder(?:\*\*)?:?\s*(.*)$/i;

export function splitAnswerBodyAndSourcesFooter(text: string): { body: string; footer: string } {
  const lines = text.split('\n');
  const kilderIdx = lines.findIndex((line) => KILDER_FOOTER_LINE_RE.test(line.trim()));
  if (kilderIdx < 0) {
    return { body: text, footer: '' };
  }
  const match = KILDER_FOOTER_LINE_RE.exec(lines[kilderIdx].trim());
  const inlineAfterColon = match?.[1]?.trim() ?? '';
  const footerLines = [...lines.slice(kilderIdx)];
  if (inlineAfterColon && footerLines.length > 0) {
    footerLines[0] = `Kilder:\n${inlineAfterColon}`;
  }
  return {
    body: lines.slice(0, kilderIdx).join('\n'),
    footer: footerLines.join('\n'),
  };
}

export function joinAnswerBodyAndSourcesFooter(body: string, footer: string): string {
  const trimmedBody = body.trimEnd();
  if (!footer) return trimmedBody.trim();
  return `${trimmedBody}\n\n${footer}`;
}
