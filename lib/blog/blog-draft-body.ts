const SOURCES_HEADING_SECTION = /^##\s*Kilder\b[\s\S]*$/im;
const GFM_FOOTNOTE_DEFINITION = /^\[\^\d+\]:.*$/gm;

/** CMS `sources` is the only public source list — strip embedded lists and GFM footnotes from body_md. */
export function sanitizeBlogDraftBodyMarkdown(body: string): string {
  let out = body.trim();
  out = out.replace(SOURCES_HEADING_SECTION, '').trim();
  out = out.replace(GFM_FOOTNOTE_DEFINITION, '').trim();
  out = out.replace(/\[\^(\d+)\]/g, '[$1]');
  return out.trim();
}

export function blogDraftBodyEmbedsSourceList(body: string): boolean {
  return /^##\s*Kilder\b/m.test(body) || /^\[\^\d+\]:/m.test(body);
}