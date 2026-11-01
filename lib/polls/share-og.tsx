import { ImageResponse } from 'next/og';
import { pollBallotAltTextPhrase } from '@/lib/polls/ballot-buttons';
import type { PollRecord, PollTotals } from '@/lib/polls/types';
import { loadOgFonts, OG_FONT_FAMILY } from '@/lib/seo/og-fonts';
import {
  SHARE_OG_FALLBACK_CACHE_CONTROL,
  SHARE_OG_LIVE_CACHE_CONTROL,
  SHARE_OG_REVALIDATE_SECONDS,
} from '@/lib/seo/share-og';
import {
  buildPollOgBarSegments,
  formatPollOgLegendLine,
  formatPollOgTotalLine,
  showPollOgProportionalBar,
} from '@/lib/polls/share-og-bar';

export const POLL_OG_CTA_LINE = 'Stem på folkets-meninger.no';

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_IMAGE_CONTENT_TYPE = 'image/png';
export const OG_IMAGE_ALT = `Folkets Meninger med spørsmålet og svarene ${pollBallotAltTextPhrase()}`;
export const OG_IMAGE_REVALIDATE_SECONDS = SHARE_OG_REVALIDATE_SECONDS;
export const OG_IMAGE_CACHE_CONTROL = SHARE_OG_LIVE_CACHE_CONTROL;

const OG_TEXT_MIN_PX = 28;
const BAR_OUTLINE = '2px solid rgba(255,255,255,0.55)';
const BAR_SEGMENT_GAP = '2px solid rgba(255,255,255,0.65)';
const TITLE_MAX_LINES = 3;
/** Summary only when the title is short enough to leave vertical room. */
const SUMMARY_TITLE_MAX_CHARS = 72;

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

function titleBoxStyle(fontSize: number) {
  const lineHeight = 1.15;
  return {
    display: 'flex',
    fontSize,
    fontWeight: 700,
    lineHeight,
    maxWidth: 1040,
    maxHeight: Math.round(fontSize * lineHeight * TITLE_MAX_LINES),
    overflow: 'hidden' as const,
  };
}

function segmentSeparatorStyle(isLast: boolean) {
  return isLast ? {} : { borderRight: BAR_SEGMENT_GAP };
}

function pollResultsBar(totals: PollTotals) {
  const segments = buildPollOgBarSegments(totals);
  const proportional = showPollOgProportionalBar(totals);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 52,
          borderRadius: 16,
          overflow: 'hidden',
          border: BAR_OUTLINE,
          background: 'rgba(255,255,255,0.08)',
        }}
      >
        {proportional ? (
          segments
            .filter((segment) => segment.percent > 0)
            .map((segment, index, visible) => (
              <div
                key={segment.choice}
                style={{
                  display: 'flex',
                  width: `${segment.percent}%`,
                  minWidth: 8,
                  height: '100%',
                  background: segment.background,
                  ...(segment.choice === 'blank'
                    ? { border: '2px solid rgba(255,255,255,0.55)' }
                    : {}),
                  ...segmentSeparatorStyle(index === visible.length - 1),
                }}
              />
            ))
        ) : (
          segments.map((segment, index) => (
            <div
              key={segment.choice}
              style={{
                display: 'flex',
                flex: 1,
                height: '100%',
                background: segment.background,
                opacity: segment.choice === 'blank' ? 0.9 : 0.28,
                ...(segment.choice === 'blank'
                  ? { border: '2px solid rgba(255,255,255,0.55)' }
                  : {}),
                ...segmentSeparatorStyle(index === segments.length - 1),
              }}
            />
          ))
        )}
      </div>
      <div style={{ display: 'flex', fontSize: OG_TEXT_MIN_PX, fontWeight: 700 }}>
        {formatPollOgLegendLine(totals)}
      </div>
      <div style={{ display: 'flex', fontSize: OG_TEXT_MIN_PX, color: 'rgba(255,255,255,0.82)' }}>
        {formatPollOgTotalLine(totals)}
      </div>
      <div style={{ display: 'flex', fontSize: OG_TEXT_MIN_PX, fontWeight: 700, color: '#ff9fb1' }}>
        {POLL_OG_CTA_LINE}
      </div>
    </div>
  );
}

/**
 * Renders the 1200×630 social preview for a shareable poll: question, live Nei/Blank/Ja
 * result bar, and Folkets Meninger branding. Callers should use the branded fallback when
 * the poll is missing or not shareable (never cache a generic image under a real poll id).
 */
export async function renderPollShareOgImage(
  poll: PollRecord,
  totals: PollTotals,
  cacheControl: string = OG_IMAGE_CACHE_CONTROL,
): Promise<ImageResponse> {
  const fonts = await loadOgFonts();
  const title = clampText(poll.title, 150);
  const titleSize = titleFontSize(title.length);
  const showSummary = title.length <= SUMMARY_TITLE_MAX_CHARS && Boolean(poll.neutralSummary);
  const summary = showSummary ? clampText(poll.neutralSummary, 100) : '';

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
          fontFamily: OG_FONT_FAMILY,
          color: '#ffffff',
          background: 'linear-gradient(135deg, #001a4a 0%, #00205b 55%, #0a3d9e 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, letterSpacing: -1 }}>
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
              fontSize: OG_TEXT_MIN_PX,
              fontWeight: 700,
            }}
          >
            Hva mener du?
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={titleBoxStyle(titleSize)}>{title}</div>
          {summary ? (
            <div
              style={{
                display: 'flex',
                fontSize: OG_TEXT_MIN_PX,
                lineHeight: 1.35,
                color: 'rgba(255,255,255,0.82)',
                maxWidth: 980,
                maxHeight: Math.round(OG_TEXT_MIN_PX * 1.35 * 2),
                overflow: 'hidden',
              }}
            >
              {summary}
            </div>
          ) : null}
          {pollResultsBar(totals)}
        </div>

        <div style={{ display: 'flex', fontSize: OG_TEXT_MIN_PX, color: 'rgba(255,255,255,0.72)' }}>
          folkets-meninger.no · Uoffisiell meningsmåling
        </div>
      </div>
    ),
    {
      ...OG_IMAGE_SIZE,
      fonts,
      headers: { 'cache-control': cacheControl },
    },
  );
}

export async function renderPollShareOgFallback(
  cacheControl: string = SHARE_OG_FALLBACK_CACHE_CONTROL,
): Promise<ImageResponse> {
  const fonts = await loadOgFonts();
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
          fontFamily: OG_FONT_FAMILY,
          color: '#ffffff',
          background: 'linear-gradient(135deg, #001a4a 0%, #00205b 55%, #0a3d9e 100%)',
        }}
      >
        <div style={{ display: 'flex', fontSize: 36, fontWeight: 700 }}>
          Folkets <span style={{ color: '#ff9fb1' }}>Meninger</span>
        </div>
        <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, lineHeight: 1.12 }}>
          Les saker, følg høringer og si din mening.
        </div>
        <div style={{ display: 'flex', fontSize: OG_TEXT_MIN_PX, color: 'rgba(255,255,255,0.72)' }}>
          folkets-meninger.no
        </div>
      </div>
    ),
    {
      ...OG_IMAGE_SIZE,
      fonts,
      headers: { 'cache-control': cacheControl },
    },
  );
}
