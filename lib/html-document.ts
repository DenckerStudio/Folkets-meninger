const BLOCKED_TAGS = /<\/?(?:script|style|iframe|object|embed|form|input|button|link|meta|base)\b[^>]*>/gi;
const ON_EVENT_ATTR = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_HREF = /\s+(href|src|xlink:href)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi;

export function sanitizeStortingetHtml(html: string): string {
  let out = html.trim();
  if (!out) return '';

  out = out.replace(BLOCKED_TAGS, '');
  out = out.replace(ON_EVENT_ATTR, '');
  out = out.replace(JS_HREF, '');

  const bodyMatch = out.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch?.[1]) {
    out = bodyMatch[1];
  }

  return out.trim();
}

export function htmlToPlainText(html: string): string {
  let text = sanitizeStortingetHtml(html);
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
}

export function wrapDocumentHtmlForDisplay(innerHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="nb">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 1.25rem; }
      .strtngt_ingress { font-size: 1.05rem; font-weight: 600; }
      .strtngt_tittel, .strtngt_kapittel > .strtngt_tittel { font-weight: 700; margin-top: 1.25rem; }
      blockquote { margin: 1rem 0; padding-left: 1rem; border-left: 3px solid #c7d2fe; color: #374151; }
      p { margin: 0.75rem 0; }
    </style>
  </head>
  <body>${innerHtml}</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
