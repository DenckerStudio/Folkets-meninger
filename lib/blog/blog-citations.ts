import { sanitizeBlogDraftBodyMarkdown } from '@/lib/blog/blog-draft-body';
import type { BlogPostSourcePublic } from '@/lib/blog/types';
import { canonicalSourceUrl } from '@/lib/sources/normalize';

const CITATION_MARKER = /\[(\d{1,3})\](?!\()/g;

function urlKey(url: string): string {
  return canonicalSourceUrl(url).toLowerCase();
}

export function remapBlogBodyCitations(
  body: string,
  previousSources: readonly BlogPostSourcePublic[],
  nextSources: readonly BlogPostSourcePublic[],
): string {
  const prevUrlByIndex = new Map(
    previousSources.map((source) => [source.index, urlKey(source.url)]),
  );
  const nextIndexByUrl = new Map(nextSources.map((source) => [urlKey(source.url), source.index]));
  const validNextIndices = new Set(nextSources.map((source) => source.index));

  return body.replace(CITATION_MARKER, (full, digits: string) => {
    const oldIndex = Number(digits);
    const prevUrl = prevUrlByIndex.get(oldIndex);
    if (prevUrl) {
      const newIndex = nextIndexByUrl.get(prevUrl);
      if (!newIndex) return '';
      return `[${newIndex}]`;
    }
    if (validNextIndices.has(oldIndex)) return full;
    return '';
  });
}

export function finalizeBlogDraftBodyWithSources(
  bodyMarkdown: string,
  previousSources: readonly BlogPostSourcePublic[],
  nextSources: readonly BlogPostSourcePublic[],
): string {
  if (nextSources.length === 0 && previousSources.length === 0) {
    return bodyMarkdown.trim();
  }
  const remapped = remapBlogBodyCitations(bodyMarkdown, previousSources, nextSources);
  return nextSources.length > 0 ? sanitizeBlogDraftBodyMarkdown(remapped) : remapped.trim();
}