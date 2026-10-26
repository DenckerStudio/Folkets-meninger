import {
  defaultBatchForProvider,
  parseBackfillProvider,
  requireBackfillUrl,
  resolveEmbeddingV2ModelTag,
  type BackfillProvider,
} from './provider';
import { resolveApiKeyFromEnvVarName } from './secrets';

export type EndpointLane = 'fast' | 'background';

export type EndpointConfigInput = {
  name: string;
  provider?: string;
  url: string;
  lanes?: string[];
  batch?: number;
  modelTag?: string;
  modelTagEnv?: string;
  primary?: boolean;
  apiKeyEnv?: string;
  apiModel?: string;
};

export type ResolvedEndpoint = {
  name: string;
  provider: BackfillProvider;
  url: string;
  lanes: EndpointLane[];
  batch: number;
  modelTag: string;
  primary: boolean;
  apiKeyEnv?: string;
  apiKey?: string;
  apiModel: string;
};

function parseLanes(raw: string[] | undefined, primary: boolean): EndpointLane[] {
  const lanes = (raw ?? (primary ? ['fast', 'background'] : ['background']))
    .map((l) => l.trim().toLowerCase())
    .filter((l): l is EndpointLane => l === 'fast' || l === 'background');
  if (lanes.length === 0) {
    throw new Error('Endpoint må ha minst én lane (fast eller background)');
  }
  if (!primary && lanes.includes('fast')) {
    throw new Error('Kun primary/server-endpoint kan ha fast lane (tier 0)');
  }
  if (!primary) {
    return ['background'];
  }
  return lanes;
}

export function resolveEndpointConfig(input: EndpointConfigInput): ResolvedEndpoint {
  const name = input.name?.trim();
  if (!name) throw new Error('Endpoint mangler name');

  const provider = parseBackfillProvider(input.provider ?? process.env.EMBED_BACKFILL_PROVIDER);
  const url = requireBackfillUrl(provider, input.url);
  const primary = Boolean(input.primary);
  const lanes = parseLanes(input.lanes, primary);
  const batch = Math.max(
    8,
    Math.min(64, input.batch ?? defaultBatchForProvider(provider)),
  );

  const apiKeyEnv =
    input.apiKeyEnv?.trim() ||
    (provider === 'lmstudio' ? 'LMSTUDIO_API_KEY' : undefined);
  const apiKey = resolveApiKeyFromEnvVarName(apiKeyEnv);

  const envModelTag = input.modelTagEnv
    ? process.env[input.modelTagEnv.trim()]?.trim()
    : process.env.EMBED_BACKFILL_MODEL_TAG?.trim();

  const modelTag = resolveEmbeddingV2ModelTag({
    provider,
    cliModelTag: input.modelTag,
    envModelTag,
  });

  return {
    name,
    provider,
    url,
    lanes,
    batch,
    modelTag,
    primary,
    apiKeyEnv,
    apiKey,
    apiModel: (input.apiModel ?? process.env.EMBED_BACKFILL_MODEL ?? 'bge-m3').trim(),
  };
}

export function parseEndpointJson(raw: string, source: string): EndpointConfigInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Ugyldig JSON for endpoint (${source})`);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Endpoint-config må være et objekt (${source})`);
  }
  const obj = parsed as EndpointConfigInput & { apiKey?: string };
  if (obj.apiKey !== undefined && String(obj.apiKey).trim() !== '') {
    throw new Error(`apiKey i endpoint-config er ikke tillatt (${source}) — bruk apiKeyEnv`);
  }
  if (!obj.url?.trim()) {
    throw new Error(`Endpoint mangler url (${source})`);
  }
  if (!obj.name?.trim()) {
    throw new Error(`Endpoint mangler name (${source})`);
  }
  return obj;
}

export function loadEndpointConfigs(
  argv: string[],
  options: { providerCli?: string } = {},
): EndpointConfigInput[] {
  const fromArgv: EndpointConfigInput[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--endpoint' && argv[i + 1]) {
      fromArgv.push(parseEndpointJson(argv[i + 1], '--endpoint'));
    }
  }

  if (fromArgv.length > 0) {
    return fromArgv;
  }

  const envJson = process.env.EMBED_BACKFILL_ENDPOINTS?.trim();
  if (envJson) {
    let arr: unknown;
    try {
      arr = JSON.parse(envJson);
    } catch {
      throw new Error('EMBED_BACKFILL_ENDPOINTS er ikke gyldig JSON');
    }
    if (!Array.isArray(arr)) {
      throw new Error('EMBED_BACKFILL_ENDPOINTS må være en JSON-array');
    }
    return arr.map((item, idx) => {
      if (!item || typeof item !== 'object') {
        throw new Error(`EMBED_BACKFILL_ENDPOINTS[${idx}] må være et objekt`);
      }
      const obj = item as EndpointConfigInput;
      if (!obj.url?.trim()) throw new Error(`EMBED_BACKFILL_ENDPOINTS[${idx}].url mangler`);
      if (!obj.name?.trim()) obj.name = `endpoint-${idx}`;
      return obj;
    });
  }

  const provider = parseBackfillProvider(
    options.providerCli ?? process.env.EMBED_BACKFILL_PROVIDER,
  );
  const url = requireBackfillUrl(provider, process.env.EMBED_BACKFILL_URL);
  return [
    {
      name: 'default',
      provider,
      url,
      primary: true,
      lanes: ['fast', 'background'],
      batch: defaultBatchForProvider(provider),
    },
  ];
}

export function finalizeEndpoints(inputs: EndpointConfigInput[]): ResolvedEndpoint[] {
  const resolved = inputs.map((input) => resolveEndpointConfig(input));
  const primaries = resolved.filter((e) => e.primary);
  if (primaries.length !== 1) {
    throw new Error(
      `Forventet nøyaktig én primary endpoint (server), fant ${primaries.length}`,
    );
  }
  return resolved;
}
