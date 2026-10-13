import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/seo/metadata';
import { isShareablePoll } from '@/lib/polls/share';
import type { PollRecord } from '@/lib/polls/types';

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_IMAGE_CONTENT_TYPE = 'image/png';
export const OG_IMAGE_ALT = 'Folkets Meninger med spørsmålet og svarene Ja, Vet ikke og Nei';

export function pollOgImageAlt(title: string): string {
  return `Spørsmål: ${title.trim()}. Svar Ja, Vet ikke eller Nei på Folkets Meninger.`;
}

function clampText(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function titleFontSize(length: number): number {
  if (length <= 60) return 64;
  if (length <= 110) return 52;
  return 44;
}

function pollButton(icon: string, label: string, background: string, color: string) {
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: '22px 0',
        borderRadius: 20,
        border: background === '#ffffff' ? 'none' : '2px solid rgba(255,255,255,0.45)',
        background,
        color,
        fontSize: 32,
        fontWeight: 700,
      }}
    >
      <span style={{ fontSize: 34 }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

/** Generic fallback used for hidden, citizen, draft or missing polls. */
function renderGenericImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px',
          fontFamily: 'sans-serif',
          color: '#ffffff',
          background: 'linear-gradient(135deg, #001a4a 0%, #00205b 55%, #0a3d9e 100%)',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>
          <span>Folkets&nbsp;</span>
          <span style={{ color: '#ff9fb1' }}>Meninger</span>
        </div>
        <div style={{ display: 'flex', marginTop: 24, fontSize: 30, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>
          Uoffisiell meningsmåling
        </div>
        <div style={{ display: 'flex', marginTop: 12, fontSize: 24, color: 'rgba(255,255,255,0.7)' }}>
          folkets-meninger.no
        </div>
      </div>
    ),
    { ...OG_IMAGE_SIZE },
  );
}

/**
 * Renders the 1200×630 social preview for a shareable poll: the question plus
 * the Ja / Vet ikke / Nei buttons and Folkets Meninger branding. Hidden or
 * legacy citizen polls fall back to a generic branded image so no question leaks.
 */
export function renderPollShareOgImage(poll: PollRecord | null): ImageResponse {
  if (!isShareablePoll(poll) || !poll) return renderGenericImage();

  const title = clampText(poll.title, 150);
  const showSummary = title.length <= 90 && Boolean(poll.neutralSummary);
  const summary = showSummary ? clampText(poll.neutralSummary, 140) : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          fontFamily: 'sans-serif',
          color: '#ffffff',
          background: 'linear-gradient(135deg, #001a4a 0%, #00205b 55%, #0a3d9e 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>
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
            Hva mener du?
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: titleFontSize(title.length),
              fontWeight: 800,
              lineHeight: 1.15,
              maxWidth: 1040,
            }}
          >
            {title}
          </div>
          {summary ? (
            <div
              style={{
                display: 'flex',
                marginTop: 20,
                fontSize: 26,
                lineHeight: 1.35,
                color: 'rgba(255,255,255,0.82)',
                maxWidth: 980,
              }}
            >
              {summary}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', gap: 18 }}>
            {pollButton('✓', 'Ja', '#0a3d9e', '#ffffff')}
            {pollButton('?', 'Vet ikke', '#ffffff', '#00205b')}
            {pollButton('✕', 'Nei', '#ba0c2f', '#ffffff')}
          </div>
          <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.72)' }}>
            folkets-meninger.no · Uoffisiell meningsmåling
          </div>
        </div>
      </div>
    ),
    { ...OG_IMAGE_SIZE },
  );
}
