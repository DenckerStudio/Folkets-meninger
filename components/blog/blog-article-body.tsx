import { ChatMarkdown } from '@/components/chat/chat-markdown';
import { extractMarkdownHeadings } from '@/lib/blog/markdown-headings';
import { cn } from '@/lib/utils';

type BlogArticleBodyProps = {
  markdown: string;
  className?: string;
};

/** Renders markdown with stable ids on h2/h3 for TOC anchors. */
export function BlogArticleBody({ markdown, className }: BlogArticleBodyProps) {
  const headings = extractMarkdownHeadings(markdown);
  let headingIndex = 0;

  const lines = markdown.split('\n');
  const chunks: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length) {
      chunks.push(buffer.join('\n'));
      buffer = [];
    }
  };

  for (const line of lines) {
    if (/^#{2,3}\s+/.test(line.trim())) {
      flush();
      const heading = headings[headingIndex];
      headingIndex += 1;
      const level = line.trim().startsWith('###') ? '###' : '##';
      const text = line.replace(/^#{2,3}\s+/, '').trim();
      chunks.push(`__HEADING__${level}__${heading?.id ?? 'section'}__${text}`);
    } else {
      buffer.push(line);
    }
  }
  flush();

  return (
    <div className={cn('space-y-5', className)}>
      {chunks.map((chunk, index) => {
        if (chunk.startsWith('__HEADING__')) {
          const match = /^__HEADING__(##|###)__(.+?)__(.+)$/.exec(chunk);
          if (!match) return null;
          const level = match[1];
          const id = match[2];
          const text = match[3];
          if (level === '##') {
            return (
              <h2 key={index} id={id} className="scroll-mt-28 text-2xl font-bold text-[#001433]">
                {text}
              </h2>
            );
          }
          return (
            <h3 key={index} id={id} className="scroll-mt-28 text-xl font-semibold text-[#001433]">
              {text}
            </h3>
          );
        }
        return (
          <div key={index}>
            <ChatMarkdown text={chunk} />
          </div>
        );
      })}
    </div>
  );
}
