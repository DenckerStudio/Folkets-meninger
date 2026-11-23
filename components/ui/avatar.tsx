import * as React from 'react';

import { cn } from '@/lib/utils';
import Image from 'next/image';

function Avatar({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="avatar"
      className={cn(
        'relative flex size-8 shrink-0 overflow-hidden rounded-full bg-muted',
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({ 
  className, 
  alt, 
  src, 
  ...props 
}: React.ComponentProps<typeof Image> & { src?: string }) {
  // If we have a src, use Next.js Image component
  if (src) {
    return (
      <Image
        data-slot="avatar-image"
        className={cn('aspect-square size-full object-cover', className)}
        alt={alt ?? ''}
        src={src}
        {...props}
      />
    );
  }
  
  // Fallback to empty Image component if no src (shouldn't happen in practice)
  return (
    <Image
      data-slot="avatar-image"
      className={cn('aspect-square size-full object-cover', className)}
      alt={alt ?? ''}
      src=""
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="avatar-fallback"
      className={cn(
        'flex size-full items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
