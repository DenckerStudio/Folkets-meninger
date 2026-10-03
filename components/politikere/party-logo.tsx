import Image from 'next/image';
import { getPartyLogoSrc } from '@/lib/party-logos';
import { cn } from '@/lib/utils';

type PartyLogoProps = {
  partyName: string;
  className?: string;
  decorative?: boolean;
};

export function PartyLogo({ partyName, className, decorative = false }: PartyLogoProps) {
  const src = getPartyLogoSrc(partyName);
  if (!src) return null;

  return (
    <Image
      src={src}
      alt={decorative ? '' : `${partyName} logo`}
      width={80}
      height={80}
      className={cn('object-contain', className)}
    />
  );
}
