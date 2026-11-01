/** Cached Noto Sans (latin + latin-ext) for OG ImageResponse — basic Latin, digits, punctuation and æøå. */

type OgFontFace = {
  name: 'Noto Sans';
  data: ArrayBuffer;
  weight: 400 | 700;
  style: 'normal';
};

const NOTO_BASE = 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@5.2.5';

const NOTO_SOURCES = {
  latin400: `${NOTO_BASE}/latin-400-normal.woff`,
  latin700: `${NOTO_BASE}/latin-700-normal.woff`,
  latinExt400: `${NOTO_BASE}/latin-ext-400-normal.woff`,
  latinExt700: `${NOTO_BASE}/latin-ext-700-normal.woff`,
} as const;

let cached: OgFontFace[] | null = null;

async function fetchFontFile(url: string, weight: 400 | 700): Promise<OgFontFace> {
  const response = await fetch(url, {
    next: { revalidate: 86_400 },
  });
  if (!response.ok) {
    throw new Error(`OG font fetch failed (${weight} ${url}): ${response.status}`);
  }
  const data = await response.arrayBuffer();
  return { name: 'Noto Sans', data, weight, style: 'normal' };
}

/** Regular + bold Noto Sans, latin and latin-ext subsets (memoized per process). */
export async function loadOgFonts(): Promise<OgFontFace[]> {
  if (cached) return cached;
  cached = await Promise.all([
    fetchFontFile(NOTO_SOURCES.latin400, 400),
    fetchFontFile(NOTO_SOURCES.latinExt400, 400),
    fetchFontFile(NOTO_SOURCES.latin700, 700),
    fetchFontFile(NOTO_SOURCES.latinExt700, 700),
  ]);
  return cached;
}

export const OG_FONT_FAMILY = 'Noto Sans';
