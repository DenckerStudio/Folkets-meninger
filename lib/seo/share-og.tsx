import { ImageResponse } from 'next/og';

export const SHARE_OG_SIZE = { width: 1200, height: 630 } as const;
export const SHARE_OG_CONTENT_TYPE = 'image/png';

/** Content images: a crawler refetch within the hour is fine; CDNs may serve stale while refreshing. */
export const SHARE_OG_CACHE_CONTROL =
  'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';
/** Fallback after a data error: keep it short so the real card replaces it soon. */
export const SHARE_OG_FALLBACK_CACHE_CONTROL = 'public, max-age=300, s-maxage=300';

export type ShareOgPill = {
  label: string;
  tone?: 'neutral' | 'accent' | 'positive';
  /** Overrides the tone colours (e.g. For / Blank / Imot flag colours). */
  colors?: { background: string; color: string };
};

export type ShareOgStat = {
  label: string;
  value: string;
  color: string;
};

export type ShareOgInput = {
  eyebrow: string;
  title: string;
  description?: string | null;
  pills?: ShareOgPill[];
  stats?: ShareOgStat[];
  footer: string;
};

const PILL_STYLE: Record<NonNullable<ShareOgPill['tone']>, { background: string; color: string }> = {
  neutral: { background: 'rgba(255,255,255,0.14)', color: '#ffffff' },
  accent: { background: '#ba0c2f', color: '#ffffff' },
  positive: { background: '#d1fae5', color: '#065f46' },
};

export function clampOgText(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function titleFontSize(length: number): number {
  if (length <= 50) return 66;
  if (length <= 90) return 56;
  if (length <= 130) return 48;
  return 42;
}

/** 1200×630 Folkets Meninger card for sak / mening links (same visual family as the poll card). */
export function renderShareOgImage(
  input: ShareOgInput,
  cacheControl: string = SHARE_OG_CACHE_CONTROL,
): ImageResponse {
  const title = clampOgText(input.title, 160);
  const description =
    input.description && title.length <= 110 ? clampOgText(input.description, 150) : '';
  const pills = (input.pills ?? []).filter((pill) => pill.label.trim()).slice(0, 3);
  const stats = input.stats ?? [];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 64px',
          fontFamily: 'sans-serif',
          color: '#ffffff',
          background: 'linear-gradient(135deg, #001a4a 0%, #00205b 55%, #0a3d9e 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>
            <span>Folkets&nbsp;</span>
            <span style={{ color: '#ff9fb1' }}>Meninger</span>
          </div>
          <div
            style={{
              display: 'flex',
              marginLeft: 20,
              padding: '8px 20px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.14)',
              fontSize: 22,
              fontWeight: 600,
            }}
          >
            {input.eyebrow}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {pills.length > 0 ? (
            <div style={{ display: 'flex', gap: 12, marginBottom: 22 }}>
              {pills.map((pill) => {
                const style = pill.colors ?? PILL_STYLE[pill.tone ?? 'neutral'];
                return (
                  <div
                    key={pill.label}
                    style={{
                      display: 'flex',
                      padding: '6px 18px',
                      borderRadius: 999,
                      fontSize: 22,
                      fontWeight: 700,
                      background: style.background,
                      color: style.color,
                    }}
                  >
                    {clampOgText(pill.label, 48)}
                  </div>
                );
              })}
            </div>
          ) : null}
          <div
            style={{
              display: 'flex',
              fontSize: titleFontSize(title.length),
              fontWeight: 800,
              lineHeight: 1.12,
              maxWidth: 1060,
            }}
          >
            {title}
          </div>
          {description ? (
            <div
              style={{
                display: 'flex',
                marginTop: 18,
                fontSize: 26,
                lineHeight: 1.35,
                color: 'rgba(255,255,255,0.82)',
                maxWidth: 1000,
              }}
            >
              {description}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.72)' }}>
            {input.footer}
          </div>
          {stats.length > 0 ? (
            <div style={{ display: 'flex', gap: 14 }}>
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 18px',
                    borderRadius: 16,
                    background: 'rgba(255,255,255,0.1)',
                    fontSize: 24,
                    fontWeight: 700,
                  }}
                >
                  <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 999, background: stat.color }} />
                  <span>{stat.label}</span>
                  <span style={{ color: 'rgba(255,255,255,0.75)' }}>{stat.value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    ),
    {
      ...SHARE_OG_SIZE,
      headers: { 'cache-control': cacheControl },
    },
  );
}

/** Branded card used when the content lookup fails (Stortinget / database unavailable). */
export function renderShareOgFallback(eyebrow: string): ImageResponse {
  return renderShareOgImage(
    {
      eyebrow,
      title: 'Les saker, følg høringer og si din mening.',
      description: 'En nøytral plattform mellom Stortinget og innbyggerne.',
      footer: 'folkets-meninger.no',
    },
    SHARE_OG_FALLBACK_CACHE_CONTROL,
  );
}
