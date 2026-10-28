'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  BlueskyIcon,
  Copy01Icon,
  Facebook01Icon,
  Linkedin01Icon,
  Mail01Icon,
  Message01Icon,
  SmartPhone01Icon,
  Tick02Icon,
  WhatsappIcon,
} from '@hugeicons/core-free-icons';
import { Dialog } from '@/components/ui/dialog';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { DEFAULT_OG_IMAGE_PATH } from '@/lib/seo/metadata';
import {
  buildShareTargetUrl,
  resolveShareUrl,
  SHARE_TARGETS,
  SHARE_TARGET_LABELS,
  shareDisplayHost,
  shareTargetOpensNewTab,
  type ShareChannel,
  type ShareTarget,
} from '@/lib/share/targets';
import { cn } from '@/lib/utils';

const TARGET_ICONS: Record<ShareTarget, IconSvgElement> = {
  facebook: Facebook01Icon,
  linkedin: Linkedin01Icon,
  bluesky: BlueskyIcon,
  whatsapp: WhatsappIcon,
  sms: Message01Icon,
  email: Mail01Icon,
};

function subscribeNoop() {
  return () => {};
}

function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export type ShareDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Canonical URL (absolute or root-relative) that is shared. */
  url: string;
  title: string;
  /** Short message used for native share, SMS, WhatsApp, Bluesky and e-post. */
  text?: string;
  /** Shown under the title in the preview card (mirrors `og:description`). */
  description?: string;
  /** Root-relative or absolute `og:image` for the preview card. */
  previewImageUrl?: string;
  /** Per-channel URL (e.g. tracking params). Defaults to `url` for every channel. */
  channelUrl?: (channel: ShareChannel) => string;
  dialogTitle?: string;
  /** Extra actions under the share options (e.g. embed for polls). */
  extraActions?: ReactNode;
  showPreview?: boolean;
};

export function ShareDialog({
  open,
  onClose,
  url,
  title,
  text,
  description,
  previewImageUrl,
  channelUrl,
  dialogTitle = 'Del',
  extraActions,
  showPreview = true,
}: ShareDialogProps) {
  const reducedMotion = usePrefersReducedMotion();
  const nativeShare = useSyncExternalStore(subscribeNoop, canNativeShare, () => false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const urlFor = useCallback(
    (channel: ShareChannel) => resolveShareUrl(channelUrl ? channelUrl(channel) : url),
    [channelUrl, url],
  );
  const displayUrl = useMemo(() => resolveShareUrl(url), [url]);
  const shareText = (text ?? title).trim();

  const handleClose = useCallback(() => {
    setCopied(false);
    setError('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyLink = async () => {
    setError('');
    try {
      await navigator.clipboard.writeText(urlFor('copy'));
      setCopied(true);
    } catch {
      setError('Kunne ikke kopiere automatisk. Marker lenken og kopier den manuelt.');
    }
  };

  const shareNative = async () => {
    setError('');
    try {
      await navigator.share({ title, text: shareText, url: urlFor('native') });
      handleClose();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError('Delingen ble avbrutt. Prøv et av alternativene under.');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={dialogTitle}
      description="Velg hvordan du vil dele. Mottakeren ser en forhåndsvisning av siden."
      size="md"
      className="sm:max-w-lg"
    >
      <div className="space-y-5">
        {showPreview ? (
          <SharePreviewCard
            key={previewImageUrl ?? 'default'}
            title={title}
            description={description}
            host={shareDisplayHost(displayUrl)}
            imageUrl={previewImageUrl}
          />
        ) : null}

        <div className="space-y-2">
          <label
            htmlFor="share-dialog-url"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Lenke
          </label>
          <div className="flex items-stretch gap-2">
            <input
              id="share-dialog-url"
              readOnly
              value={displayUrl}
              onFocus={(event) => event.currentTarget.select()}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-muted/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
            <button
              type="button"
              onClick={() => void copyLink()}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors',
                copied
                  ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-[#0b1220]'
                  : 'bg-brand text-brand-foreground hover:bg-brand/90',
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={copied ? 'copied' : 'copy'}
                  initial={reducedMotion ? false : { scale: 0.6, opacity: 0, rotate: -20 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={reducedMotion ? undefined : { scale: 0.6, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                  className="inline-flex"
                >
                  <HugeiconsIcon
                    icon={copied ? Tick02Icon : Copy01Icon}
                    className="h-4 w-4"
                    aria-hidden
                  />
                </motion.span>
              </AnimatePresence>
              {copied ? 'Kopiert' : 'Kopier'}
            </button>
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            {copied ? 'Lenken er kopiert' : ''}
          </p>
        </div>

        {nativeShare ? (
          <button
            type="button"
            onClick={() => void shareNative()}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <HugeiconsIcon icon={SmartPhone01Icon} className="h-4 w-4" aria-hidden />
            Flere valg på enheten
          </button>
        ) : null}

        <ul className="grid grid-cols-3 gap-2" aria-label="Del til">
          {SHARE_TARGETS.map((target, index) => {
            const newTab = shareTargetOpensNewTab(target);
            return (
              <motion.li
                key={target}
                initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reducedMotion ? 0 : 0.04 * index, duration: 0.25 }}
              >
                <a
                  href={buildShareTargetUrl(target, {
                    url: urlFor(target),
                    title,
                    text: shareText,
                  })}
                  target={newTab ? '_blank' : undefined}
                  rel={newTab ? 'noreferrer noopener' : undefined}
                  className="group flex min-h-11 flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground transition-transform group-hover:scale-110 group-active:scale-95 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                    <HugeiconsIcon icon={TARGET_ICONS[target]} className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  {SHARE_TARGET_LABELS[target]}
                </a>
              </motion.li>
            );
          })}
        </ul>

        {extraActions ? <div className="border-t border-border pt-4">{extraActions}</div> : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

type SharePreviewCardProps = {
  title: string;
  description?: string;
  host: string;
  imageUrl?: string;
};

/** Mirrors the link card chat apps and social networks build from the page's Open Graph tags. */
function SharePreviewCard({ title, description, host, imageUrl }: SharePreviewCardProps) {
  const [src, setSrc] = useState(imageUrl || DEFAULT_OG_IMAGE_PATH);
  const [loaded, setLoaded] = useState(false);

  return (
    <figure className="space-y-2">
      <figcaption className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Forhåndsvisning
      </figcaption>
      <div className="flex overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:block">
        <div className="relative aspect-[1200/630] w-32 shrink-0 self-center bg-muted sm:w-full">
          {!loaded ? (
            <div className="absolute inset-0 animate-pulse bg-muted motion-reduce:animate-none" aria-hidden />
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic OG route, not a static asset */}
          <img
            src={src}
            alt=""
            width={1200}
            height={630}
            onLoad={() => setLoaded(true)}
            onError={() => {
              if (src !== DEFAULT_OG_IMAGE_PATH) setSrc(DEFAULT_OG_IMAGE_PATH);
              else setLoaded(true);
            }}
            className={cn(
              'h-full w-full object-cover transition-opacity duration-300',
              loaded ? 'opacity-100' : 'opacity-0',
            )}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1 border-l border-border px-3 py-2.5 sm:border-l-0 sm:border-t sm:px-4 sm:py-3">
          {host ? (
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{host}</p>
          ) : null}
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{title}</p>
          {description ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
    </figure>
  );
}
