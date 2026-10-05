'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
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
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, `oklch(0.86 0.18 ${blob.hue} / 0.72)`);
    glow.addColorStop(0.45, `oklch(0.7 0.16 ${blob.hue} / 0.28)`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
  const shine = ctx.createRadialGradient(size * 0.32, size * 0.28, 0, size * 0.32, size * 0.28, size * 0.28);
  shine.addColorStop(0, 'oklch(1 0 0 / 0.42)');
  shine.addColorStop(1, 'transparent');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}

export function ChatOrb() {
  const pathname = usePathname();
  const { open, openChat, closeChat } = useChatOverlay();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let running = true;

    const resize = () => {
      const cssSize = canvas.clientWidth || 58;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
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

  return (
    <button
      type="button"
      className="chat-orb"
      data-chat-orb=""
      data-open={open ? 'true' : 'false'}
      aria-expanded={open}
      aria-controls="stemme-chat-panel"
      aria-label={open ? 'Lukk AI-chat' : 'Åpne AI-chat'}
      onClick={() => {
        if (open) closeChat();
        else {
          const sak = issueIdFromPathname(pathname);
          openChat(sak ? { issueId: sak } : null);
        }
      }}
    >
      <span className="chat-orb-halo" aria-hidden />
      <span className="chat-orb-core">
        <canvas ref={canvasRef} className="chat-orb-canvas" />
        <span className="chat-orb-sheen" aria-hidden />
      </span>
    </button>
  );
}
