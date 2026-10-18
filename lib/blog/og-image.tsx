import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/seo/metadata';

export const BLOG_OG_SIZE = { width: 1200, height: 630 };
export const BLOG_OG_CONTENT_TYPE = 'image/png';

function truncate(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

export function renderBlogPostOgImage(title: string, excerpt: string) {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#00205b',
          padding: '72px',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: '#ba0c2f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            FM
          </div>
          <div style={{ fontSize: 26, fontWeight: 600 }}>{SITE_NAME}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.08 }}>{truncate(title, 120)}</div>
          {excerpt ? (
            <div style={{ fontSize: 28, lineHeight: 1.35, color: '#c9d6f0', maxWidth: 980 }}>
              {truncate(excerpt, 160)}
            </div>
          ) : null}
        </div>
        <div style={{ fontSize: 26, color: '#f3b6c4' }}>folkets-meninger.no/blogg</div>
      </div>
    ),
    { ...BLOG_OG_SIZE },
  );
}
