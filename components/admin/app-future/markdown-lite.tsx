import { cn } from '@/lib/utils';

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function inlineMarkdown(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(/`(.+?)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-[0.85em]">$1</code>');
  return out;
}

/** Enkel markdown-forhåndsvisning (fet, kursiv, lister, avsnitt). */
export function MarkdownLite({ source, className }: { source: string; className?: string }) {
  const lines = source.split('\n');
  const blocks: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      `<ul class="list-disc space-y-1 pl-5">${listItems.map((li) => `<li>${inlineMarkdown(li)}</li>`).join('')}</ul>`,
    );
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(trimmed.slice(2));
      continue;
    }
    flushList();
    if (!trimmed) {
      blocks.push('<div class="h-2" aria-hidden="true"></div>');
      continue;
    }
    blocks.push(`<p class="leading-relaxed">${inlineMarkdown(trimmed)}</p>`);
  }
  flushList();

  return (
    <div
      className={cn('text-sm text-foreground [&_code]:font-mono', className)}
      dangerouslySetInnerHTML={{ __html: blocks.join('') }}
    />
  );
}
