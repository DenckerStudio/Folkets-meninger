'use client';

import { Dialog } from '@/components/ui/dialog';
import { routes } from '@/lib/routes';

type SakPreviewDialogProps = {
  issueId: string | null;
  title?: string | null;
  onClose: () => void;
  onSelect?: (issueId: string) => void;
};

export function SakPreviewDialog({ issueId, title, onClose, onSelect }: SakPreviewDialogProps) {
  const open = Boolean(issueId);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title?.trim() || 'Saken'}
      description="Forhåndsvisning på denne siden, så du ikke mister det du har skrevet."
      size="xl"
      footer={
        issueId && onSelect ? (
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Lukk
            </button>
            <button
              type="button"
              onClick={() => {
                onSelect(issueId);
                onClose();
              }}
              className="rounded-full bg-[#00205B] px-5 py-2 text-sm font-semibold text-white hover:bg-[#00205B]/90"
            >
              Velg denne saken
            </button>
          </div>
        ) : undefined
      }
    >
      {issueId ? (
        <iframe
          title={title?.trim() || `Sak ${issueId}`}
          src={routes.sakEmbed(issueId)}
          data-sak-preview-frame={issueId}
          className="-mx-5 -my-5 h-[min(70vh,720px)] w-[calc(100%+2.5rem)] border-0 bg-background"
        />
      ) : null}
    </Dialog>
  );
}
