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
      <Tag className="text-2xl font-bold tracking-tight text-gray-900">{title}</Tag>
      {description ? <p className="text-gray-600">{description}</p> : null}
    </div>
  );
}
