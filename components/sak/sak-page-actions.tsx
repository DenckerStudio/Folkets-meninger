'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Facebook,
  Linkedin,
  Mail,
  MessagesSquare,
  Quote,
  Share2,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useSakShare } from '@/components/sak/sak-share-context';
import { redditCommunityName, redditOAuthStartPath } from '@/lib/reddit';
import { emailShareUrl, facebookShareUrl, linkedInShareUrl, twitterIntentUrl } from '@/lib/share';
import { cn } from '@/lib/utils';

export function SakPageActions({ className = '' }: { className?: string }) {
  const share = useSakShare();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const copyLink = async () => {
    const url = share.getPageUrl();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const nativeShare = async () => {
    const url = share.getPageUrl();
    if (!url) return;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Folkets Stemme: ${share.title}`,
          text: share.title,
          url,
        });
        setOpen(false);
        return;
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
      }
    }
    await copyLink();
  };

  const menuPageUrl = open ? share.getPageUrl() : '';
  const redditHref = redditOAuthStartPath({
    kind: 'submit',
    title: share.title,
    url: `/dashboard/sak/${share.sakId}`,
    next: pathname || `/dashboard/sak/${share.sakId}`,
  });

  return (
    <nav
      aria-label="Sakshandlinger"
      className={cn('flex flex-wrap items-center justify-end gap-2', className)}
    >
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="menu"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
          {copied ? 'Kopiert' : 'Del'}
        </button>
        {open ? (
          <div
            role="menu"
            className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg"
          >
            <MenuButton
              onClick={() => {
                void copyLink();
                setOpen(false);
              }}
            >
              <Copy className="h-4 w-4" />
              Kopier lenke
            </MenuButton>
            <MenuButton
              onClick={() => {
                share.openQuoteShare({ quote: '', sourceLabel: share.title });
                setOpen(false);
              }}
            >
              <Quote className="h-4 w-4" />
              Del sitat
            </MenuButton>
            <MenuButton onClick={() => void nativeShare()}>
              <Share2 className="h-4 w-4" />
              Del via enhet
            </MenuButton>
            {menuPageUrl ? (
              <>
                <div className="my-1 border-t border-border" />
                <MenuLink href={twitterIntentUrl({ title: share.title, url: menuPageUrl })}>Del på X</MenuLink>
                <MenuLink href={facebookShareUrl(menuPageUrl)}>
                  <Facebook className="h-4 w-4" />
                  Facebook
                </MenuLink>
                <MenuLink href={linkedInShareUrl(menuPageUrl)}>
                  <Linkedin className="h-4 w-4" />
                  LinkedIn
                </MenuLink>
                <MenuLink href={emailShareUrl({ title: share.title, url: menuPageUrl })}>
                  <Mail className="h-4 w-4" />
                  E-post
                </MenuLink>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      <a
        href={redditHref}
        title={`Logg inn med Reddit og bli med i r/${redditCommunityName()}`}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-3 text-sm font-medium text-white hover:bg-brand/90"
      >
        <MessagesSquare className="h-4 w-4" />
        <span className="hidden min-[420px]:inline">Diskuter i Reddit</span>
        <span className="min-[420px]:hidden">Reddit</span>
      </a>
      <span className="sr-only">
        Logg inn med Reddit for å bli med i r/{redditCommunityName()}
      </span>
    </nav>
  );
}

function MenuButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
    >
      {children}
    </button>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      role="menuitem"
      target={href.startsWith('mailto:') ? undefined : '_blank'}
      rel={href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
    >
      {children}
    </a>
  );
}
