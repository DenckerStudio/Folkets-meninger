import Link from 'next/link';
import { LandingSectionContainer } from '@/components/landing-section-container';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type TrustDocLayoutProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
};

export function TrustDocLayout({ title, description, children, className }: TrustDocLayoutProps) {
  return (
    <div className={cn('pb-16 pt-6', className)}>
      <LandingSectionContainer>
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Tillit og åpenhet</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">{title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{description}</p>
          <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-brand">
            <Link href={routes.personvern} className="hover:text-brand/80">Personvern og infrastruktur</Link>
            <Link href={routes.omAi} className="hover:text-brand/80">AI og modeller</Link>
            <Link href={routes.omOss} className="hover:text-brand/80">Om oss</Link>
            <Link href={routes.innspill} className="hover:text-brand/80">Gi innspill</Link>
          </nav>
          <div className="mt-10 space-y-6 text-muted-foreground">{children}</div>
        </div>
      </LandingSectionContainer>
    </div>
  );
}
