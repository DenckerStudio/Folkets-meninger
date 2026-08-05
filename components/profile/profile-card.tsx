import { cn } from '@/lib/utils';

type ProfileCardProps = {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function ProfileCard({ title, description, children, className }: ProfileCardProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-card p-6 shadow-sm space-y-4',
        className,
      )}
    >
      {(title || description) && (
        <header>
          {title ? <h3 className="text-lg font-semibold text-foreground">{title}</h3> : null}
          {description ? (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          ) : null}
        </header>
      )}
      {children}
    </section>
  );
}
