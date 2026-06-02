import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { routes } from '@/lib/routes';
import { parseUrl } from '@/lib/forum/sanitize-links';

const PATH_RE = /(\/dashboard\/[^\s<>"')\]]+)/g;
const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

function pathLabel(path: string): string {
  if (path.startsWith(`${routes.forum}/`)) return 'Forumtråd';
  if (path.startsWith(`${routes.horinger}/`)) return 'Høring';
  if (path.includes('/sak/')) return 'Stortingssak';
  if (path === routes.utforsk) return 'Utforsk saker';
  if (path === routes.horinger) return 'Høringer';
  return 'Intern lenke';
}

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

function renderLine(line: string, lineKey: string) {
  const combined = line.split(/(\/dashboard\/[^\s<>"')\]]+|https?:\/\/[^\s<>"')\]]+)/g);

  return (
    <span key={lineKey}>
      {combined.map((part, index) => {
        if (part.startsWith('/dashboard/')) {
          return (
            <Link
              key={`${lineKey}-${index}`}
              href={part}
              className="text-indigo-600 hover:text-indigo-500 font-medium underline underline-offset-2"
            >
              {pathLabel(part)}
            </Link>
          );
        }

        if (/^https?:\/\//i.test(part)) {
          return renderExternalLink(part, `${lineKey}-url-${index}`);
        }

        const mentionParts = part.split(/(@[\p{L}0-9_.-]{2,32})/giu);
        return mentionParts.map((segment, segIndex) => {
          if (segment.startsWith('@')) {
            return (
              <span
                key={`${lineKey}-${index}-${segIndex}`}
                className="text-indigo-700 bg-indigo-50 px-1 rounded font-medium"
              >
                {segment}
              </span>
            );
          }
          return <span key={`${lineKey}-${index}-${segIndex}`}>{segment}</span>;
        });
      })}
    </span>
  );
}

export function FormattedForumBody({ text, className }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n{2,}/);

  return (
    <div className={className ? `prose prose-sm max-w-none ${className}` : 'prose prose-sm max-w-none text-gray-700'}>
      {paragraphs.map((paragraph, pIndex) => {
        const lines = paragraph.split('\n');
        return (
          <p key={pIndex} className={pIndex > 0 ? 'mt-4' : undefined}>
            {lines.map((line, lIndex) => (
              <span key={`${pIndex}-${lIndex}`}>
                {lIndex > 0 && <br />}
                {renderLine(line, `${pIndex}-${lIndex}`)}
              </span>
            ))}
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
