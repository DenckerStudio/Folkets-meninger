/** Split chat-style answers into body and optional «Kilder:» footer (unchanged by refusal polish). */

function matchKilderFooterLine(trimmed: string): { rest: string } | null {
  const plain = /^Kilder:\s*(.*)$/i.exec(trimmed);
  if (plain) return { rest: plain[1] };

  const heading = /^(#{1,6}\s+Kilder)(?:\s*:\s*(.*))?$/i.exec(trimmed);
  if (heading) return { rest: heading[2]?.trim() ?? '' };

  const boldWithColon = /^\*\*Kilder:\*\*\s*(.*)$/i.exec(trimmed);
  if (boldWithColon) return { rest: boldWithColon[1].trim() };

  const boldNoColon = /^\*\*Kilder\*\*\s*(.*)$/i.exec(trimmed);
  if (boldNoColon) return { rest: boldNoColon[1].trim() };

  return null;
}

export function splitAnswerBodyAndSourcesFooter(text: string): { body: string; footer: string } {
  const lines = text.split('\n');
  const kilderIdx = lines.findIndex((line) => matchKilderFooterLine(line.trim()) !== null);
  if (kilderIdx < 0) {
    return { body: text, footer: '' };
  }
  const match = matchKilderFooterLine(lines[kilderIdx].trim());
  const inlineAfterColon = match?.rest.trim() ?? '';
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
