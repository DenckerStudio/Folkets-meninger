'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ExpandableButton } from '@/components/ui/expandable-button';
import { useChatOverlay } from '@/components/chat/chat-overlay-context';
import { issueIdFromPathname } from '@/lib/chat/overlay';
import './chat-orb.css';

type BlobSpec = {
  hue: number;
  size: number;
  radius: number;
  speedX: number;
  speedY: number;
  phase: number;
};

const BLOBS: BlobSpec[] = [
  { hue: 255, size: 0.42, radius: 0.18, speedX: 0.7, speedY: 0.55, phase: 0.2 },
  { hue: 310, size: 0.36, radius: 0.2, speedX: 0.45, speedY: 0.8, phase: 1.4 },
  { hue: 200, size: 0.34, radius: 0.16, speedX: 0.9, speedY: 0.4, phase: 2.6 },
  { hue: 28, size: 0.28, radius: 0.14, speedX: 0.6, speedY: 0.7, phase: 3.8 },
];

function readCssColor(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function paintOrb(ctx: CanvasRenderingContext2D, size: number, time: number, brand: string, accent: string) {
  const mid = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(mid, mid, mid - 1, 0, Math.PI * 2);
  ctx.clip();

  const base = ctx.createRadialGradient(size * 0.38, size * 0.34, size * 0.05, mid, mid, mid);
  base.addColorStop(0, brand);
  base.addColorStop(0.55, accent);
  base.addColorStop(1, 'oklch(0.18 0.05 255)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = 'lighter';
  for (const blob of BLOBS) {
    const x = mid + Math.sin(time * blob.speedX + blob.phase) * size * blob.radius;
    const y = mid + Math.cos(time * blob.speedY + blob.phase * 0.8) * size * blob.radius;
    const radius = size * blob.size;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `oklch(0.72 0.14 ${blob.hue})`);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function ChatOrbIcon({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  return (
    <span className="chat-orb-orb" aria-hidden>
      <span className="chat-orb-halo" />
      <span className="chat-orb-core">
        <canvas ref={canvasRef} className="chat-orb-canvas" />
        <span className="chat-orb-sheen" />
      </span>
    </span>
  );
}

export function ChatOrb() {
  const pathname = usePathname();
  const { open, openChat, closeChat } = useChatOverlay();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [peekOpen, setPeekOpen] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let running = true;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');

    const resize = () => {
      const cssSize = 58;
      const ratio = window.devicePixelRatio || 1;
      canvas.style.width = `${cssSize}px`;
      canvas.style.height = `${cssSize}px`;
      canvas.width = Math.round(cssSize * ratio);
      canvas.height = Math.round(cssSize * ratio);
    };

    const draw = (timeMs: number) => {
      if (!running) return;
      const brand = readCssColor('--brand', '#00205b');
      const accent = readCssColor('--brand-accent', '#ba0c2f');
      paintOrb(ctx, canvas.width, media.matches ? 0 : timeMs / 900, brand, accent);
      if (!media.matches) {
        frame = window.requestAnimationFrame(draw);
      }
    };

    resize();
    draw(0);
    window.addEventListener('resize', resize);
    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const expanded = peekOpen && !open;

  return (
    <ExpandableButton
      className="chat-orb"
      data-chat-orb=""
      data-open={open ? 'true' : 'false'}
      expanded={expanded}
      toggleOnClick={false}
      onPointerEnter={() => setPeekOpen(true)}
      onPointerLeave={() => setPeekOpen(false)}
      onFocus={() => setPeekOpen(true)}
      onBlur={() => setPeekOpen(false)}
      aria-expanded={open}
      aria-controls="stemme-chat-panel"
      aria-label={open ? 'Lukk chat' : 'Åpne chat'}
      icon={<ChatOrbIcon canvasRef={canvasRef} />}
      onClick={() => {
        if (open) closeChat();
        else {
          const sak = issueIdFromPathname(pathname);
          openChat(sak ? { issueId: sak } : null);
        }
      }}
    >
      Spør Stemme+
    </ExpandableButton>
  );
}
