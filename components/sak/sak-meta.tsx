'use client';

import { Building2, ExternalLink, FileText, Users, type LucideIcon } from 'lucide-react';
import { SAK_META_TOOLTIPS } from '@/lib/stortinget-sak-tooltips';
import {
  getSakTreatmentBadgeClassName,
  getSakTreatmentLabel,
  getSakTreatmentTooltipKey,
  type SakTreatmentStatus,
} from '@/lib/sak-status';
import { useSakTooltipsEnabled } from '@/components/theme-provider';
import { InfoTooltip, LabeledWithTooltip } from '@/components/ui/info-tooltip';

export const SAK_META_ICONS = {
  'file-text': FileText,
  'external-link': ExternalLink,
  'building-2': Building2,
  users: Users,
} as const;

export type SakMetaIconName = keyof typeof SAK_META_ICONS;

type SakMetaCardProps = {
  icon: SakMetaIconName;
  label: string;
  tooltipKey: keyof typeof SAK_META_TOOLTIPS;
  children: React.ReactNode;
};

export function SakMetaCard({ icon, label, tooltipKey, children }: SakMetaCardProps) {
  const showTooltips = useSakTooltipsEnabled();
  const Icon = SAK_META_ICONS[icon];

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

export function SakProcessingBadge({
  status,
  size = 'md',
}: {
  status: SakTreatmentStatus;
  size?: 'sm' | 'md';
}) {
  const showTooltips = useSakTooltipsEnabled();
  const label = getSakTreatmentLabel(status);
  const tooltipKey = getSakTreatmentTooltipKey(status);
  const sizeClass = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <SakStatusBadge
      label={label}
      tooltip={showTooltips ? SAK_META_TOOLTIPS[tooltipKey] : undefined}
      className={`${sizeClass} ${getSakTreatmentBadgeClassName(status)}`}
    />
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
  iconClassName,
}: {
  title: string;
  tooltipKey?: keyof typeof SAK_META_TOOLTIPS;
  icon?: SakMetaIconName;
  iconClassName?: string;
}) {
  const showTooltips = useSakTooltipsEnabled();
  const Icon: LucideIcon | null = icon ? SAK_META_ICONS[icon] : null;

  return (
    <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
      {Icon ? <Icon className={iconClassName ?? 'w-5 h-5 text-indigo-600 dark:text-indigo-400'} /> : null}
      <span>{title}</span>
      {showTooltips && tooltipKey ? (
        <InfoTooltip label={title} description={SAK_META_TOOLTIPS[tooltipKey]} side="bottom" />
      ) : null}
    </h2>
  );
}
