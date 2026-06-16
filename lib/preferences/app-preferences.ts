export type ThemeMode = 'light' | 'dark' | 'system';

export type MotionPreference = 'system' | 'reduce' | 'full';

export type AppPreferences = {
  theme: ThemeMode;
  motion: MotionPreference;
  sakTooltips: boolean;
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  theme: 'system',
  motion: 'system',
  sakTooltips: true,
};

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function isMotionPreference(value: unknown): value is MotionPreference {
  return value === 'system' || value === 'reduce' || value === 'full';
}

export function isAppPreferences(value: unknown): value is AppPreferences {
  if (!value || typeof value !== 'object') return false;
  const prefs = value as AppPreferences;
  return (
    isThemeMode(prefs.theme) &&
    isMotionPreference(prefs.motion) &&
    typeof prefs.sakTooltips === 'boolean'
  );
}

export function mergeAppPreferences(value: unknown): AppPreferences {
  if (!value || typeof value !== 'object') return DEFAULT_APP_PREFERENCES;
  const prefs = value as Partial<AppPreferences>;
  return {
    theme: isThemeMode(prefs.theme) ? prefs.theme : DEFAULT_APP_PREFERENCES.theme,
    motion: isMotionPreference(prefs.motion) ? prefs.motion : DEFAULT_APP_PREFERENCES.motion,
    sakTooltips:
      typeof prefs.sakTooltips === 'boolean' ? prefs.sakTooltips : DEFAULT_APP_PREFERENCES.sakTooltips,
  };
}

export function resolveThemeMode(theme: ThemeMode): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function shouldReduceMotion(motion: MotionPreference): boolean {
  if (motion === 'reduce') return true;
  if (motion === 'full') return false;
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function applyAppPreferencesToDocument(prefs: AppPreferences): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const resolvedTheme = resolveThemeMode(prefs.theme);
  root.classList.toggle('dark', resolvedTheme === 'dark');
  root.classList.toggle('motion-reduce', shouldReduceMotion(prefs.motion));
  root.dataset.theme = prefs.theme;
  root.dataset.motion = prefs.motion;
}
