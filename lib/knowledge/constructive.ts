import { CONSTRUCTIVE_COMMENT_MIN_CHARS, CONSTRUCTIVE_COMMENT_MIN_WORDS } from './types';

export function isConstructiveArgument(text: string): boolean {
  const body = text.replace(/\s+/g, ' ').trim();
  if (body.length < CONSTRUCTIVE_COMMENT_MIN_CHARS) return false;
  const words = body.split(' ').filter((word) => word.length > 1);
  if (words.length < CONSTRUCTIVE_COMMENT_MIN_WORDS) return false;
  const unique = new Set(words.map((word) => word.toLowerCase()));
  return unique.size >= 8;
}
