'use client';

import { ShareTrigger } from '@/components/share/share-trigger';
import { routes } from '@/lib/routes';
import { opinionShareDescription } from '@/lib/opinions/share';

type OpinionShareButtonProps = {
  opinion: { id: string; title: string; body: string };
  label?: string;
  className?: string;
};

export function OpinionShareButton({ opinion, label, className }: OpinionShareButtonProps) {
  const path = routes.opinion(opinion.id);
  const title = (opinion.title || 'Mening').trim();

  return (
    <ShareTrigger
      label={label}
      ariaLabel={label ? undefined : `Del meningen «${title}»`}
      dialogTitle="Del meningen"
      url={path}
      title={title}
      text={`Hva mener du? «${title}» på Folkets Meninger`}
      description={opinionShareDescription(opinion)}
      previewImageUrl={`${path}/opengraph-image`}
      className={className}
    />
  );
}
