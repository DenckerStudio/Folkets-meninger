'use client';

import { MeshGradient } from '@paper-design/shaders-react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';

/** Norwegian flag–inspired palette for Paper Shaders MeshGradient (21st.dev / Paper Design). */
const NORWAY_MESH_COLORS = [
  '#ffffff',
  '#f4d4db',
  '#ba0c2f',
  '#00205b',
  '#d9e4f5',
  '#6b86b5',
];

type LandingMeshBackgroundProps = {
  className?: string;
};

/**
 * Animated WebGL mesh gradient (Paper Shaders / 21st.dev Mesh Gradient).
 * Falls back to a soft static CSS mesh when the user prefers reduced motion.
 */
export function LandingMeshBackground({ className }: LandingMeshBackgroundProps) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return (
      <div className={cn('absolute inset-0 overflow-hidden bg-white', className)} aria-hidden>
        <div className="absolute -top-[25%] -left-[20%] h-[75%] w-[60%] rounded-full bg-[#ba0c2f]/25 blur-[100px]" />
        <div className="absolute top-[5%] -right-[15%] h-[65%] w-[55%] rounded-full bg-[#00205b]/22 blur-[110px]" />
        <div className="absolute bottom-[-20%] left-[15%] h-[55%] w-[50%] rounded-full bg-[#00205b]/15 blur-[120px]" />
        <div className="absolute top-[30%] left-[30%] h-[45%] w-[45%] rounded-full bg-white/85 blur-[90px]" />
      </div>
    );
  }

  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)} aria-hidden>
      <MeshGradient
        className="absolute inset-0 h-full w-full"
        colors={NORWAY_MESH_COLORS}
        speed={0.35}
        distortion={0.85}
        swirl={0.28}
        grainMixer={0.12}
        grainOverlay={0.04}
        scale={1.15}
      />
      {/* Soft white veil so hero copy stays readable on the animated mesh */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/55 via-white/35 to-white/60" />
    </div>
  );
}
