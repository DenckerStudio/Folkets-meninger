import { ImageResponse } from 'next/og';
import { pollBallotAltTextPhrase } from '@/lib/polls/ballot-buttons';
import { POLL_BALLOT_CHOICES, pollChoiceLabel } from '@/lib/polls/labels';
import type { PollChoice, PollRecord } from '@/lib/polls/types';

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_IMAGE_CONTENT_TYPE = 'image/png';
export const OG_IMAGE_ALT = `Folkets Meninger med spørsmålet og svarene ${pollBallotAltTextPhrase()}`;
/**
 * Only shareable polls get a long-lived immutable cache. Unknown, hidden or
 * legacy `citizen` polls return 404 (see the image routes) so a future poll at
 * the same id is never stuck behind a year-long cached fallback.
 */
export const OG_IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export function pollOgImageAlt(title: string): string {
  return `Spørsmål: ${title.trim()}. Svar ${pollBallotAltTextPhrase()} på Folkets Meninger.`;
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

type ChoiceIconKind = 'check' | 'minus' | 'cross';

const OG_CHOICE_ICON: Record<PollChoice, ChoiceIconKind> = {
  ja: 'check',
  nei: 'cross',
  blank: 'minus',
};

const OG_CHOICE_STYLE: Record<PollChoice, { background: string; color: string }> = {
  ja: { background: '#0a3d9e', color: '#ffffff' },
  nei: { background: '#ba0c2f', color: '#ffffff' },
  blank: { background: '#ffffff', color: '#00205b' },
};

const CHOICE_ICON_PATHS: Record<ChoiceIconKind, string> = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  minus: '<path d="M5 12h14"/>',
  cross: '<path d="M18 6 6 18M6 6l12 12"/>',
};

/**
 * Renders the ballot glyph as an SVG data URI. The default OG font has no
 * ✓/✕ glyphs, so drawing them as text produced tofu boxes; a real SVG renders
 * identically everywhere satori runs.
 */
function choiceIconSrc(kind: ChoiceIconKind, color: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" ` +
    `fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">` +
    `${CHOICE_ICON_PATHS[kind]}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function pollButton(
  kind: ChoiceIconKind,
  label: string,
  background: string,
  color: string,
) {
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={choiceIconSrc(kind, color)} width={34} height={34} alt="" />
      <span>{label}</span>
    </div>
  );
}

/**
 * Renders the 1200×630 social preview for a shareable poll: the question plus
 * the Nei / Blank / Ja buttons and Folkets Meninger branding. The caller is
 * responsible for rejecting unknown or non-shareable polls with a 404 so no
 * question leaks and no generic image is cached under a real poll id.
 */
export function renderPollShareOgImage(
  poll: PollRecord,
  cacheControl: string = OG_IMAGE_CACHE_CONTROL,
): ImageResponse {
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
            {POLL_BALLOT_CHOICES.map((choice) => {
              const style = OG_CHOICE_STYLE[choice];
              return pollButton(
                OG_CHOICE_ICON[choice],
                pollChoiceLabel(choice),
                style.background,
                style.color,
              );
            })}
          </div>
          <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.72)' }}>
            folkets-meninger.no · Uoffisiell meningsmåling
          </div>
        </div>
      </div>
    ),
    {
      ...OG_IMAGE_SIZE,
      headers: { 'cache-control': cacheControl },
    },
  );
}
