import opentype from 'opentype.js';
import { loadOgFonts } from '@/lib/seo/og-fonts';

export const POLL_OG_TITLE_MAX_WIDTH = 1060;
export const POLL_OG_TITLE_LINE_HEIGHT = 1.2;
export const POLL_OG_TITLE_MAX_LINES = 2;

export type PollOgTitleMeasurer = {
  measureWidth(text: string, fontSize: number): number;
  lineCount(text: string, fontSize: number): number;
  fitsTwoLines(text: string, fontSize: number): boolean;
};

let measurerPromise: Promise<PollOgTitleMeasurer> | null = null;

function breakLongToken(
  token: string,
  measureWidth: (value: string) => number,
): string[] {
  if (measureWidth(token) <= POLL_OG_TITLE_MAX_WIDTH) return [token];
  const parts: string[] = [];
  let chunk = '';
  for (const char of token) {
    const next = chunk + char;
    if (measureWidth(next) <= POLL_OG_TITLE_MAX_WIDTH) {
      chunk = next;
      continue;
    }
    if (chunk) parts.push(chunk);
    chunk = char;
  }
  if (chunk) parts.push(chunk);
  return parts.length > 0 ? parts : [token];
}

function wrapLines(
  text: string,
  fontSize: number,
  maxWidth: number,
  measureWidth: (value: string) => number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const tokens = words.flatMap((word) => breakLongToken(word, measureWidth));

  const lines: string[] = [];
  let line = '';

  for (const token of tokens) {
    const candidate = line ? `${line} ${token}` : token;
    if (measureWidth(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = measureWidth(token) <= maxWidth ? token : token;
    if (measureWidth(line) > maxWidth) {
      for (const part of breakLongToken(line, measureWidth)) {
        lines.push(part);
      }
      line = '';
    }
  }

  if (line) lines.push(line);
  return lines;
}

export function createPollOgTitleMeasurer(font: opentype.Font): PollOgTitleMeasurer {
  const measureWidth = (text: string, fontSize: number) =>
    font.getAdvanceWidth(text, fontSize);

  return {
    measureWidth,
    lineCount(text, fontSize) {
      return wrapLines(text, fontSize, POLL_OG_TITLE_MAX_WIDTH, (value) =>
        measureWidth(value, fontSize),
      ).length;
    },
    fitsTwoLines(text, fontSize) {
      return this.lineCount(text, fontSize) <= POLL_OG_TITLE_MAX_LINES;
    },
  };
}

/** Noto Sans 700 latin-ext — same subset Satori uses for æøå in OG cards. */
export async function loadPollOgTitleMeasurer(): Promise<PollOgTitleMeasurer> {
  if (measurerPromise) return measurerPromise;

  measurerPromise = (async () => {
    const faces = await loadOgFonts();
    const latinExt700 = faces[3];
    if (!latinExt700 || latinExt700.weight !== 700) {
      throw new Error('loadPollOgTitleMeasurer: expected latin-ext 700 Noto Sans face');
    }
    const font = opentype.parse(latinExt700.data);
    return createPollOgTitleMeasurer(font);
  })();

  return measurerPromise;
}

/** Test hook: reset memoized font (unit tests only). */
export function resetPollOgTitleMeasurerCacheForTests(): void {
  measurerPromise = null;
}
