import type { ReactNode } from 'react';
import { parseMarkdown, type InlineNode } from '@/lib/chat/markdown';
import { cn } from '@/lib/utils';

function renderInline(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'strong':
        return (
          <strong key={index} className="font-semibold text-foreground">
            {node.value}
          </strong>
        );
      case 'em':
        return <em key={index}>{node.value}</em>;
      case 'code':
        return (
          <code
            key={index}
            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
          >
            {node.value}
          </code>
        );
      case 'link':
        return (
          <a
            key={index}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand underline underline-offset-2 hover:text-brand/80"
          >
            {node.value}
          </a>
        );
      default:
        return <span key={index}>{node.value}</span>;
    }
  });
}

const HEADING_CLASS: Record<number, string> = {
  1: 'text-base font-semibold',
  2: 'text-[0.95rem] font-semibold',
  3: 'text-sm font-semibold',
};

export function ChatMarkdown({ text, className }: { text: string; className?: string }) {
  const blocks = parseMarkdown(text);

  return (
    <div className={cn('space-y-2', className)}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <p key={index} className={HEADING_CLASS[block.level] ?? 'text-sm font-semibold'}>
              {renderInline(block.nodes)}
            </p>
          );
        }
        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag
              key={index}
              className={cn(
                'space-y-1 pl-4',
                block.ordered ? 'list-decimal' : 'list-disc',
              )}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ListTag>
          );
        }
        if (block.type === 'code') {
          return (
            <pre
              key={index}
              className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs text-foreground"
            >
              <code>{block.value}</code>
            </pre>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            {renderInline(block.nodes)}
          </p>
        );
      })}
    </div>
  );
}
