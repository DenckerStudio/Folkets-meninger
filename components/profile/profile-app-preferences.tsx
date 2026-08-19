'use client';

import { Monitor, Moon, Sun, Sparkles, Info, Map } from 'lucide-react';
import {
  type AppPreferences,
  type MotionPreference,
  type ThemeMode,
} from '@/lib/preferences/app-preferences';
import { useAppPreferences } from '@/components/theme-provider';
import { PRODUCT_TOUR_EVENT, PRODUCT_TOUR_STORAGE_KEY } from '@/lib/onboarding';

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
}: OptionCardProps<T>) {
  const selected = value === current;

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
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
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function ProfileAppPreferences() {
  const [preferences, setPreferences] = useAppPreferences();

  const update = (patch: Partial<AppPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="space-y-6">
      <PreferenceSection
        title="Utseende"
        description="Velg lys eller mørk modus. Innstillingen lagres i nettleseren din."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <OptionCard<ThemeMode>
            value="light"
            current={preferences.theme}
            label="Lys"
            description="Lyst grensesnitt"
            icon={<Sun className="h-4 w-4" />}
            onSelect={(theme) => update({ theme })}
          />
          <OptionCard<ThemeMode>
            value="dark"
            current={preferences.theme}
            label="Mørk"
            description="Mørkt grensesnitt"
            icon={<Moon className="h-4 w-4" />}
            onSelect={(theme) => update({ theme })}
          />
          <OptionCard<ThemeMode>
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
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <OptionCard<MotionPreference>
            value="system"
            current={preferences.motion}
            label="System"
            description="Følg enhetens innstilling"
            icon={<Monitor className="h-4 w-4" />}
            onSelect={(motion) => update({ motion })}
          />
          <OptionCard<MotionPreference>
            value="reduce"
            current={preferences.motion}
            label="Redusert"
            description="Mindre animasjon og bevegelse"
            icon={<Sparkles className="h-4 w-4" />}
            onSelect={(motion) => update({ motion })}
          />
          <OptionCard<MotionPreference>
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
      >
        <label className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4 cursor-pointer">
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

      <PreferenceSection
        title="Omvisning"
        description="En kort gjennomgang av hvor Utforsk, høringer, Min side og varsler ligger."
      >
        <button
          type="button"
          onClick={() => {
            window.localStorage.removeItem(PRODUCT_TOUR_STORAGE_KEY);
            void fetch('/api/user/onboarding', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'tour_reset' }),
            }).finally(() => {
              window.dispatchEvent(new Event(PRODUCT_TOUR_EVENT));
            });
          }}
          className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50"
        >
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <Map className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">Start omvisning på nytt</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Popup-guiden vises på dashbordet og peker på menyen og varsler. Bare omvisningen kan hoppes over.
            </span>
          </span>
        </button>
      </PreferenceSection>
    </div>
  );
}
