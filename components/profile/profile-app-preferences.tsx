'use client';

import { Monitor, Moon, Sun, Sparkles, Info } from 'lucide-react';
import {
  type AppPreferences,
  type MotionPreference,
  type ThemeMode,
} from '@/lib/preferences/app-preferences';
import { useAppPreferences } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

type OptionCardProps<T extends string> = {
  value: T;
  current: T;
  label: string;
  description: string;
  icon: React.ReactNode;
  onSelect: (value: T) => void;
};

function OptionCard<T extends string>({
  value,
  current,
  label,
  description,
  icon,
  onSelect,
  compact = false,
}: OptionCardProps<T> & { compact?: boolean }) {
  const selected = value === current;

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex w-full items-start gap-3 rounded-xl border text-left transition-colors ${
        compact ? 'p-3' : 'p-4'
      } ${
        selected
          ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-950/40'
          : 'border-border bg-card hover:bg-muted/50'
      }`}
      aria-pressed={selected}
    >
      <span
        className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          selected ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

function PreferenceSection({
  title,
  description,
  children,
  compact = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        'space-y-3 border border-border bg-card shadow-sm',
        compact ? 'rounded-xl p-3' : 'space-y-4 rounded-2xl p-6',
      )}
    >
      <div>
        <h3 className={cn('font-semibold text-foreground', compact ? 'text-sm' : 'text-lg')}>
          {title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function ProfileAppPreferences({ compact = false }: { compact?: boolean }) {
  const [preferences, setPreferences] = useAppPreferences();

  const update = (patch: Partial<AppPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className={compact ? 'space-y-3' : 'space-y-6'}>
      <PreferenceSection
        title="Utseende"
        description="Velg lys eller mørk modus. Innstillingen lagres i nettleseren din."
        compact={compact}
      >
        <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
          <OptionCard<ThemeMode>
            compact={compact}
            value="light"
            current={preferences.theme}
            label="Lys"
            description="Lyst grensesnitt"
            icon={<Sun className="h-4 w-4" />}
            onSelect={(theme) => update({ theme })}
          />
          <OptionCard<ThemeMode>
            compact={compact}
            value="dark"
            current={preferences.theme}
            label="Mørk"
            description="Mørkt grensesnitt"
            icon={<Moon className="h-4 w-4" />}
            onSelect={(theme) => update({ theme })}
          />
          <OptionCard<ThemeMode>
            compact={compact}
            value="system"
            current={preferences.theme}
            label="System"
            description="Følg enhetens innstilling"
            icon={<Monitor className="h-4 w-4" />}
            onSelect={(theme) => update({ theme })}
          />
        </div>
      </PreferenceSection>

      <PreferenceSection
        title="Animasjoner"
        description="Tilpass bevegelse og overganger etter hva som passer best for deg."
        compact={compact}
      >
        <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
          <OptionCard<MotionPreference>
            compact={compact}
            value="system"
            current={preferences.motion}
            label="System"
            description="Følg enhetens innstilling"
            icon={<Monitor className="h-4 w-4" />}
            onSelect={(motion) => update({ motion })}
          />
          <OptionCard<MotionPreference>
            compact={compact}
            value="reduce"
            current={preferences.motion}
            label="Redusert"
            description="Mindre animasjon og bevegelse"
            icon={<Sparkles className="h-4 w-4" />}
            onSelect={(motion) => update({ motion })}
          />
          <OptionCard<MotionPreference>
            compact={compact}
            value="full"
            current={preferences.motion}
            label="Full"
            description="Vis alle animasjoner"
            icon={<Sparkles className="h-4 w-4" />}
            onSelect={(motion) => update({ motion })}
          />
        </div>
      </PreferenceSection>

      <PreferenceSection
        title="Hjelp i saker"
        description="Vis korte forklaringer når du leser om saksgang og stortingstermer."
        compact={compact}
      >
        <label
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30',
            compact ? 'p-3' : 'p-4',
          )}
        >
          <input
            type="checkbox"
            checked={preferences.sakTooltips}
            onChange={(e) => update({ sakTooltips: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-input text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Info className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Vis hjelpetekster i saker
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Forklarer steg som «Fremmet», «Sendt til komité» og andre begreper på en enkel måte.
            </span>
          </span>
        </label>
      </PreferenceSection>
    </div>
  );
}
