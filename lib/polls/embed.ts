import { z } from 'zod';

/**
 * Validated embed query parameters for `/embed/[id]`. Unknown or invalid values
 * fall back to defaults instead of throwing, so a broken partner snippet still
 * renders a working widget. Parameters are read by developers, so the keys are
 * English; every string the voter sees is Norwegian.
 */

export type PollEmbedTheme = 'light' | 'dark' | 'auto';
export type PollEmbedSize = 'full' | 'compact';

export type PollEmbedOptions = {
  theme: PollEmbedTheme;
  size: PollEmbedSize;
  /** Corner radius in px (0–24). */
  radius: number;
  /** Whether the widget keeps its 1px border. */
  border: boolean;
  /** Whether the `full` size shows the poll summary. */
  summary: boolean;
  /** Partner or campaign tag (`[a-z0-9-]`, max 32 chars). */
  ref: string | null;
};

export const DEFAULT_EMBED_RADIUS = 16;

const themeSchema = z.enum(['light', 'dark', 'auto']).catch('auto');
const sizeSchema = z.enum(['full', 'compact']).catch('full');
const flagSchema = z.enum(['0', '1']).catch('1');
const radiusSchema = z.coerce.number().int().min(0).max(24).catch(DEFAULT_EMBED_RADIUS);
const refSchema = z
  .string()
  .regex(/^[a-z0-9-]{1,32}$/)
  .nullable()
  .catch(null);

const embedSchema = z.object({
  theme: themeSchema,
  size: sizeSchema,
  radius: radiusSchema,
  border: flagSchema,
  summary: flagSchema,
  ref: refSchema,
});

export type PollEmbedSearchParams =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function readParam(input: PollEmbedSearchParams, key: string): string | undefined {
  if (input instanceof URLSearchParams) return input.get(key) ?? undefined;
  const value = input[key];
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

export function parsePollEmbedOptions(input: PollEmbedSearchParams): PollEmbedOptions {
  const rawRef = readParam(input, 'ref')?.trim().toLowerCase() || null;
  const parsed = embedSchema.parse({
    theme: readParam(input, 'theme'),
    size: readParam(input, 'size'),
    radius: readParam(input, 'radius'),
    border: readParam(input, 'border'),
    summary: readParam(input, 'summary'),
    ref: rawRef,
  });

  const size = parsed.size;
  return {
    theme: parsed.theme,
    size,
    radius: parsed.radius,
    border: parsed.border === '1',
    summary: parsed.summary === '1' && size === 'full',
    ref: parsed.ref,
  };
}

/** Serialize embed options back into a query string (used by the configurator). */
export function serializePollEmbedOptions(options: Partial<PollEmbedOptions>): string {
  const params = new URLSearchParams();
  if (options.theme) params.set('theme', options.theme);
  if (options.size) params.set('size', options.size);
  if (options.radius != null && options.radius !== DEFAULT_EMBED_RADIUS) {
    params.set('radius', String(options.radius));
  }
  if (options.border === false) params.set('border', '0');
  if (options.size === 'full' && options.summary === false) params.set('summary', '0');
  if (options.ref) params.set('ref', options.ref);
  return params.toString();
}
