import opentype from 'opentype.js';
import { loadOgFonts } from '@/lib/seo/og-fonts';

export const POLL_OG_TITLE_MAX_WIDTH = 1060;
export const POLL_OG_TITLE_LINE_HEIGHT = 1.2;
export const POLL_OG_TITLE_MAX_LINES = 2;

export type PollOgTitleMeasurer = {
  measureWidth(text: string, fontSize: number): number;
  lineCount(text: string, fontSize: number): number;
  fitsTwoLines(text: string, fontSize: number): boolean;
  /** True if any character would use .notdef in both faces. */
  hasNotDefGlyph(text: string): boolean;
};

let measurerPromise: Promise<PollOgTitleMeasurer> | null = null;

function glyphForChar(font: opentype.Font, char: string): opentype.Glyph {
  return font.charToGlyph(char);
}

export function isNotDefGlyph(font: opentype.Font, char: string): boolean {
  const glyph = glyphForChar(font, char);
  return glyph.index === 0 || glyph.name === '.notdef';
}

function glyphAdvance(font: opentype.Font, char: string, fontSize: number): number {
  const glyph = glyphForChar(font, char);
  const scale = fontSize / font.unitsPerEm;
  return (glyph.advanceWidth ?? 0) * scale;
}

/** Prefer latin-700; fall back to latin-ext-700 only when latin lacks the glyph. */
export function measurePollOgTextWidth(
  latin700: opentype.Font,
  latinExt700: opentype.Font,
  text: string,
  fontSize: number,
): number {
  let width = 0;
  for (const char of text) {
    if (!isNotDefGlyph(latin700, char)) {
      width += glyphAdvance(latin700, char, fontSize);
      continue;
    }
    if (!isNotDefGlyph(latinExt700, char)) {
      width += glyphAdvance(latinExt700, char, fontSize);
      continue;
    }
    width += glyphAdvance(latin700, char, fontSize);
  }
  return width;
}

export function pollOgTextHasNotDefGlyph(
  latin700: opentype.Font,
  latinExt700: opentype.Font,
  text: string,
): boolean {
  for (const char of text) {
    if (isNotDefGlyph(latin700, char) && isNotDefGlyph(latinExt700, char)) {
      return true;
    }
  }
  return false;
}

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

function wrapLines(text: string, measureWidth: (value: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const tokens = words.flatMap((word) => breakLongToken(word, measureWidth));

  const lines: string[] = [];
  let line = '';

  for (const token of tokens) {
    const candidate = line ? `${line} ${token}` : token;
    if (measureWidth(candidate) <= POLL_OG_TITLE_MAX_WIDTH) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = measureWidth(token) <= POLL_OG_TITLE_MAX_WIDTH ? token : token;
    if (measureWidth(line) > POLL_OG_TITLE_MAX_WIDTH) {
      for (const part of breakLongToken(line, measureWidth)) {
        lines.push(part);
      }
      line = '';
    }
  }

  if (line) lines.push(line);
  return lines;
}

/** Wrapped title lines at fontSize — same rules as lineCount / Satori width. */
export function layoutPollOgTitleLines(
  text: string,
  fontSize: number,
  measurer: Pick<PollOgTitleMeasurer, 'measureWidth'>,
): string[] {
  return wrapLines(text, (value) => measurer.measureWidth(value, fontSize));
}

export function maxPollOgTitleLineWidth(
  text: string,
  fontSize: number,
  measurer: Pick<PollOgTitleMeasurer, 'measureWidth'>,
): number {
  const lines = layoutPollOgTitleLines(text, fontSize, measurer);
  if (lines.length === 0) return 0;
  return Math.max(...lines.map((line) => measurer.measureWidth(line, fontSize)));
}

export function createDualFontPollOgTitleMeasurer(
  latin700: opentype.Font,
  latinExt700: opentype.Font,
): PollOgTitleMeasurer {
  const measureWidth = (text: string, fontSize: number) =>
    measurePollOgTextWidth(latin700, latinExt700, text, fontSize);

  return {
    measureWidth,
    lineCount(text, fontSize) {
      return wrapLines(text, (value) => measureWidth(value, fontSize)).length;
    },
    fitsTwoLines(text, fontSize) {
      return this.lineCount(text, fontSize) <= POLL_OG_TITLE_MAX_LINES;
    },
    hasNotDefGlyph(text) {
      return pollOgTextHasNotDefGlyph(latin700, latinExt700, text);
    },
  };
}

/** Noto Sans 700 latin + latin-ext — matches Satori fallback pairing for OG titles. */
export async function loadPollOgTitleMeasurer(): Promise<PollOgTitleMeasurer> {
  if (measurerPromise) return measurerPromise;

  measurerPromise = (async () => {
    const faces = await loadOgFonts();
    const latin700 = faces[2];
    const latinExt700 = faces[3];
    if (!latin700 || latin700.weight !== 700) {
      throw new Error('loadPollOgTitleMeasurer: expected latin 700 Noto Sans face');
    }
    if (!latinExt700 || latinExt700.weight !== 700) {
      throw new Error('loadPollOgTitleMeasurer: expected latin-ext 700 Noto Sans face');
    }
    return createDualFontPollOgTitleMeasurer(
      opentype.parse(latin700.data),
      opentype.parse(latinExt700.data),
    );
  })();

  return measurerPromise;
}

/** Test hook: reset memoized font (unit tests only). */
export function resetPollOgTitleMeasurerCacheForTests(): void {
  measurerPromise = null;
}

/** Test hook: load parsed font pair for glyph assertions. */
export async function loadPollOgTitleMeasurerFonts(): Promise<{
  latin700: opentype.Font;
  latinExt700: opentype.Font;
}> {
  const faces = await loadOgFonts();
  return {
    latin700: opentype.parse(faces[2]!.data),
    latinExt700: opentype.parse(faces[3]!.data),
  };
}
