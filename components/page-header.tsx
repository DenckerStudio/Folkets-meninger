import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: string;
  description?: string;
  className?: string;
  as?: 'h1' | 'h2';
};

export function PageHeader({ title, description, className, as: Tag = 'h1' }: PageHeaderProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Tag className="text-2xl font-bold tracking-tight text-foreground">{title}</Tag>
      {description ? <p className="text-muted-foreground">{description}</p> : null}
    </div>
  );
}
