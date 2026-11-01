/** Cached Noto Sans (latin-ext) for OG ImageResponse — renders æ, ø and å reliably. */

type OgFontFace = {
  name: 'Noto Sans';
  data: ArrayBuffer;
  weight: 400 | 700;
  style: 'normal';
};

const NOTO_LATIN_EXT = {
  400: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@5.2.5/latin-ext-400-normal.woff',
  700: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@5.2.5/latin-ext-700-normal.woff',
} as const;

let cached: OgFontFace[] | null = null;

async function fetchFont(weight: 400 | 700): Promise<OgFontFace> {
  const response = await fetch(NOTO_LATIN_EXT[weight], {
    next: { revalidate: 86_400 },
  });
  if (!response.ok) {
    throw new Error(`OG font fetch failed (${weight}): ${response.status}`);
  }
  const data = await response.arrayBuffer();
  return { name: 'Noto Sans', data, weight, style: 'normal' };
}

/** Bold + regular Noto Sans for social preview cards (memoized per process). */
export async function loadOgFonts(): Promise<OgFontFace[]> {
  if (cached) return cached;
  const [regular, bold] = await Promise.all([fetchFont(400), fetchFont(700)]);
  cached = [regular, bold];
  return cached;
}

export const OG_FONT_FAMILY = 'Noto Sans';
