import { ChatMarkdown } from '@/components/chat/chat-markdown';
import { cn } from '@/lib/utils';

type BlogMarkdownProps = {
  markdown: string;
  className?: string;
};

export function BlogMarkdown({ markdown, className }: BlogMarkdownProps) {
  return (
    <div
      className={cn(
        'prose prose-neutral max-w-none text-[#001433]/80 prose-headings:text-[#001433] prose-a:text-[#00205b] prose-a:no-underline hover:prose-a:text-[#ba0c2f] prose-strong:text-[#001433] dark:prose-invert',
        className,
      )}
    >
      <ChatMarkdown text={markdown} />
    </div>
  );
}
