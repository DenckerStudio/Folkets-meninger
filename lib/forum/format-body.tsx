'use client';

import { ExternalLink } from 'lucide-react';
import { DashboardLink } from '@/components/dashboard-link';
import type { ForumContextItem } from '@/lib/forum/context';
import { parseBodySegments } from '@/lib/forum/parse-body-links';
import { parseUrl } from '@/lib/forum/sanitize-links';

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
const PATH_RE = /(\/dashboard\/[^\s<>"')\]]+)/g;

function renderExternalLink(url: string, key: string) {
  const parsed = parseUrl(url);
  if (!parsed?.isAllowed) {
    return <span key={key} className="text-gray-400">[lenke fjernet]</span>;
  }

  let label = parsed.host || 'Ekstern kilde';
  try {
    label = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* keep label */
  }

  return (
    <span key={key} className="inline-flex items-center gap-1 flex-wrap">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-600 hover:text-indigo-500 font-medium underline underline-offset-2 inline-flex items-center gap-1"
      >
        {label}
        <ExternalLink className="w-3 h-3 shrink-0" />
      </a>
      <span className="text-[10px] uppercase tracking-wide font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
        Ekstern kilde
      </span>
    </span>
  );
}

function renderSegments(segments: ReturnType<typeof parseBodySegments>, keyPrefix: string) {
  return segments.map((segment, index) => {
    if (segment.type === 'text') {
      return <span key={`${keyPrefix}-${index}`}>{segment.text}</span>;
    }

    if (segment.type === 'mention') {
      return (
        <span
          key={`${keyPrefix}-${index}`}
          className="text-indigo-700 bg-indigo-50 px-1 rounded font-medium"
        >
          {segment.text}
        </span>
      );
    }

    return (
      <DashboardLink
        key={`${keyPrefix}-${index}`}
        href={segment.href}
        meta={segment.meta}
        className="font-medium"
      >
        {segment.label}
      </DashboardLink>
    );
  });
}

export function FormattedForumBody({
  text,
  className,
  contextItems = [],
}: {
  text: string;
  className?: string;
  contextItems?: ForumContextItem[];
}) {
  const paragraphs = text.split(/\n{2,}/);

  return (
    <div className={className ? `prose prose-sm max-w-none ${className}` : 'prose prose-sm max-w-none text-gray-700'}>
      {paragraphs.map((paragraph, pIndex) => {
        const lines = paragraph.split('\n');
        return (
          <p key={pIndex} className={pIndex > 0 ? 'mt-4' : undefined}>
            {lines.map((line, lIndex) => {
              const lineKey = `${pIndex}-${lIndex}`;
              const segments = parseBodySegments(line, contextItems);
              const hasOnlyText = segments.every((s) => s.type === 'text');

              if (hasOnlyText && /https?:\/\//i.test(line)) {
                const parts = line.split(/(https?:\/\/[^\s<>"')\]]+)/gi);
                return (
                  <span key={lineKey}>
                    {lIndex > 0 && <br />}
                    {parts.map((part, partIndex) =>
                      /^https?:\/\//i.test(part)
                        ? renderExternalLink(part, `${lineKey}-ext-${partIndex}`)
                        : part
                    )}
                  </span>
                );
              }

              return (
                <span key={lineKey}>
                  {lIndex > 0 && <br />}
                  {renderSegments(segments, lineKey)}
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}

export function stripUrlsForExcerpt(text: string, maxLen = 200): string {
  const stripped = text
    .replace(URL_RE, '')
    .replace(PATH_RE, '')
    .replace(/\n+/g, ' ')
    .trim();
  if (stripped.length <= maxLen) return stripped;
  return `${stripped.slice(0, maxLen).trim()}…`;
}
