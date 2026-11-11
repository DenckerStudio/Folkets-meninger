import type { BackfillSupabase } from './supabase-client';

type RpcBuilder = ReturnType<BackfillSupabase['rpc']>;

function withAbortTimeout(builder: RpcBuilder, timeoutMs: number): RpcBuilder {
  const maybe = builder as RpcBuilder & {
    abortSignal?: (signal: AbortSignal) => RpcBuilder;
  };
  if (typeof maybe.abortSignal === 'function') {
    return maybe.abortSignal(AbortSignal.timeout(timeoutMs));
  }
  return builder;
}

/**
 * Wraps supabase.rpc so every call gets a client-side AbortSignal deadline.
 */
export function withDbRpcTimeout(
  supabase: BackfillSupabase,
  timeoutMs: number,
): BackfillSupabase {
  const baseRpc = supabase.rpc.bind(supabase);

  const rpc = ((fn: string, args?: Record<string, unknown>, options?: Record<string, unknown>) => {
    const builder = baseRpc(fn, args, options);
    return withAbortTimeout(builder, timeoutMs);
  }) as BackfillSupabase['rpc'];

  return new Proxy(supabase, {
    get(target, prop, receiver) {
      if (prop === 'rpc') {
        return rpc;
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as BackfillSupabase;
}
