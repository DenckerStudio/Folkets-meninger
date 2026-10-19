export type TocHeading = {
  id: string;
  text: string;
  level: 2 | 3;
};

function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function extractMarkdownHeadings(markdown: string): TocHeading[] {
  const lines = markdown.split('\n');
  const headings: TocHeading[] = [];
  const used = new Map<string, number>();

  for (const line of lines) {
    const match = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (!match) continue;
    const level = match[1].length === 2 ? 2 : 3;
    const text = match[2].replace(/\s+#+\s*$/, '').trim();
    if (!text) continue;
    let id = slugifyHeading(text);
    const count = used.get(id) ?? 0;
    if (count > 0) id = `${id}-${count + 1}`;
    used.set(slugifyHeading(text), count + 1);
    headings.push({ id, text, level });
  }

  return headings;
}
