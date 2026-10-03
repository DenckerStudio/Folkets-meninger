import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CallToActionProps = {
  title: string;
  subtitle: string;
  primaryButtonText: string;
  primaryButtonLink: string;
  secondaryButtonText: string;
  secondaryButtonLink: string;
  className?: string;
};

/**
 * CallToActionHero-style section (21st.dev / Dhileep Kumar GM).
 * Prop-driven CTA with decorative background blobs and responsive buttons.
 */
export default function CallToAction({
  title,
  subtitle,
  primaryButtonText,
  primaryButtonLink,
  secondaryButtonText,
  secondaryButtonLink,
  className,
}: CallToActionProps) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-3xl border border-[#00205b]/12 bg-white px-6 py-16 sm:px-10 sm:py-20',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[#ba0c2f]/15 blur-3xl" />
        <div className="absolute -right-16 top-1/3 h-56 w-56 rounded-full bg-[#00205b]/18 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-[#ba0c2f]/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.9),_transparent_55%)]" />
      </div>

      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <h2 className="text-balance text-3xl font-extrabold tracking-tight text-[#001433] sm:text-4xl md:text-5xl">
          {title}
        </h2>
        <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-[#001433]/65 sm:text-lg">
          {subtitle}
        </p>

        <div className="mt-10 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Link
            href={primaryButtonLink}
            className="inline-flex items-center justify-center rounded-full bg-[#00205b] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ba0c2f]"
          >
            {primaryButtonText}
          </Link>
          <Link
            href={secondaryButtonLink}
            className="inline-flex items-center justify-center rounded-full border border-[#00205b]/15 bg-white/80 px-7 py-3.5 text-sm font-semibold text-[#00205b] transition-colors hover:border-[#00205b]/40 hover:bg-white"
          >
            {secondaryButtonText}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
