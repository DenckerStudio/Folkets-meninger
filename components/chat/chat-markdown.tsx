import type { ReactNode } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { parseMarkdown, type InlineNode } from '@/lib/chat/markdown';
import type { ChatSourceLink } from '@/lib/chat/source-links';
import { cn } from '@/lib/utils';

type SourceMap = ReadonlyMap<number, ChatSourceLink>;

// The chip stays small visually; the ::after overlay plus min-width give a
// hit area of about 24×28 px so [n] is tappable on a phone.
const CITATION_CLASS =
  "relative mx-0.5 inline-flex min-w-[1.5rem] items-center justify-center gap-0.5 rounded bg-brand/10 px-1 py-0.5 align-baseline text-[0.75em] font-semibold text-brand no-underline hover:bg-brand/20 focus-visible:outline-2 focus-visible:outline-brand after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']";

const NEW_TAB_TEXT = 'åpnes i ny fane';

function renderCitation(n: number, key: number, sources?: SourceMap): ReactNode {
  const source = sources?.get(n);
  if (!source) return <span key={key}>[{n}]</span>;
  const label = `Kilde ${n}: ${source.title}`;
  if (source.external) {
    return (
      <a
        key={key}
        href={source.href}
        target="_blank"
        rel="noopener noreferrer"
        title={`${label} (${NEW_TAB_TEXT})`}
        aria-label={`${label} (${NEW_TAB_TEXT})`}
        data-chat-citation={n}
        data-external=""
        className={CITATION_CLASS}
      >
        [{n}]
        <ExternalLink className="size-[0.85em] shrink-0" aria-hidden />
      </a>
    );
  }
  return (
    <Link key={key} href={source.href} title={label} aria-label={label} data-chat-citation={n} className={CITATION_CLASS}>
      [{n}]
    </Link>
  );
}

function renderInline(nodes: InlineNode[], sources?: SourceMap): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'citation':
        return renderCitation(node.n, index, sources);
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
            <span className="sr-only"> ({NEW_TAB_TEXT})</span>
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

export function ChatMarkdown({
  text,
  className,
  sources,
}: {
  text: string;
  className?: string;
  /** `[n]` → link for this message (see `collectChatSourceLinks`). */
  sources?: SourceMap;
}) {
  const blocks = parseMarkdown(text);

  return (
    <div className={cn('space-y-2', className)}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <p key={index} className={HEADING_CLASS[block.level] ?? 'text-sm font-semibold'}>
              {renderInline(block.nodes, sources)}
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
                <li key={itemIndex}>{renderInline(item, sources)}</li>
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
            {renderInline(block.nodes, sources)}
          </p>
        );
      })}
    </div>
  );
}
