'use client';

/**
 * Adapted from 21st.dev ahmedmayara/ai-assistant-card (demo id 6242).
 * Install path was blocked (21st API key / free quota); vendored to match the
 * Card + welcome + quick-action badges + textarea + footer shell.
 * Norwegian copy; no model select; no user-visible "AI" branding.
 */
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type AssistantQuickAction = {
  id: string;
  label: string;
  icon?: ReactNode;
};

type AiAssistantCardProps = {
  titleId?: string;
  descriptionId?: string;
  title?: string;
  description?: string;
  onClose?: () => void;
  headerExtra?: ReactNode;
  welcomeTitle?: string;
  welcomeDescription?: string;
  welcomeIcon?: ReactNode;
  quickActions?: AssistantQuickAction[];
  onQuickAction?: (action: AssistantQuickAction) => void;
  showWelcome?: boolean;
  messages?: ReactNode;
  footer?: ReactNode;
  toolbar?: ReactNode;
  className?: string;
  children?: ReactNode;
};

export function AiAssistantCard({
  titleId,
  descriptionId,
  title = 'Chat',
  description,
  onClose,
  headerExtra,
  welcomeTitle,
  welcomeDescription,
  welcomeIcon,
  quickActions = [],
  onQuickAction,
  showWelcome = false,
  messages,
  footer,
  toolbar,
  className,
  children,
}: AiAssistantCardProps) {
  return (
    <div
      data-assistant-card=""
      className={cn(
        'relative z-10 flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl',
        className,
      )}
    >
      <header className="flex shrink-0 items-start justify-between gap-3 px-4 pb-1 pt-3">
        <div className="min-w-0 flex-1">
          {title ? (
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              {title}
            </h2>
          ) : null}
          {description ? (
            <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
          {headerExtra}
        </div>
        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={onClose}
            aria-label="Lukk chat"
          >
            <X className="h-5 w-5" />
          </Button>
        ) : null}
      </header>

      {toolbar}

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-1">
        {children ? (
          children
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2">
              {showWelcome ? (
                <div className="flex flex-col items-center gap-4 px-2 py-8 text-center">
                  {welcomeIcon ? (
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-foreground">
                      {welcomeIcon}
                    </div>
                  ) : null}
                  {welcomeTitle ? (
                    <div className="space-y-1.5">
                      <p className="text-lg font-semibold tracking-tight text-foreground">
                        {welcomeTitle}
                      </p>
                      {welcomeDescription ? (
                        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                          {welcomeDescription}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {quickActions.length > 0 ? (
                    <div className="flex flex-wrap justify-center gap-2 pt-1">
                      {quickActions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          data-chat-quick-action={action.id}
                          onClick={() => onQuickAction?.(action)}
                          className="inline-flex"
                        >
                          <Badge
                            variant="secondary"
                            className="cursor-pointer gap-1.5 px-3 py-1.5 text-xs font-medium hover:bg-secondary/80"
                          >
                            {action.icon}
                            {action.label}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {messages}
            </div>
            {footer}
          </>
        )}
      </div>
    </div>
  );
}
