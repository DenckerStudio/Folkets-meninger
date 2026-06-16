'use client';

import type { ComponentType } from 'react';
import { SAK_META_TOOLTIPS } from '@/lib/stortinget-sak-tooltips';
import { useSakTooltipsEnabled } from '@/components/theme-provider';
import { InfoTooltip, LabeledWithTooltip } from '@/components/ui/info-tooltip';

type SakMetaCardProps = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  tooltipKey: keyof typeof SAK_META_TOOLTIPS;
  children: React.ReactNode;
};

export function SakMetaCard({ icon: Icon, label, tooltipKey, children }: SakMetaCardProps) {
  const showTooltips = useSakTooltipsEnabled();

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
      <Icon className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <LabeledWithTooltip
        label={label}
        tooltip={SAK_META_TOOLTIPS[tooltipKey]}
        showTooltip={showTooltips}
        className="min-w-0 flex-1"
      >
        <div className="text-sm font-semibold text-foreground">{children}</div>
      </LabeledWithTooltip>
    </div>
  );
}

export function SakStatusBadge({
  label,
  tooltip,
  className,
}: {
  label: string;
  tooltip?: string;
  className: string;
}) {
  const showTooltips = useSakTooltipsEnabled();

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${className}`}>
      {label}
      {showTooltips && tooltip ? <InfoTooltip label={label} description={tooltip} side="bottom" /> : null}
    </span>
  );
}

export function SakSectionHeading({
  title,
  tooltipKey,
  icon,
}: {
  title: string;
  tooltipKey?: keyof typeof SAK_META_TOOLTIPS;
  icon?: React.ReactNode;
}) {
  const showTooltips = useSakTooltipsEnabled();

  return (
    <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
      {icon}
      <span>{title}</span>
      {showTooltips && tooltipKey ? (
        <InfoTooltip label={title} description={SAK_META_TOOLTIPS[tooltipKey]} side="bottom" />
      ) : null}
    </h2>
  );
}
