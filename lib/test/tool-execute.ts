import type { ModelMessage, ToolExecutionOptions } from 'ai';

type ToolTestContext = Record<string, unknown>;

/** Minimal ToolExecutionOptions for direct `.execute()` calls in unit tests. */
export function mockToolExecuteOptions(
  toolCallId: string,
  overrides?: Partial<ToolExecutionOptions<ToolTestContext>>,
): ToolExecutionOptions<ToolTestContext> {
  return {
    toolCallId,
    messages: [] as ModelMessage[],
    context: {},
    ...overrides,
  };
}

/** AI SDK tools may return a value or an async iterable of partial updates. */
export async function unwrapToolExecuteResult<T>(value: T | AsyncIterable<T>): Promise<T> {
  if (value != null && typeof value === 'object' && Symbol.asyncIterator in value) {
    let last: T | undefined;
    for await (const chunk of value as AsyncIterable<T>) {
      last = chunk;
    }
    if (last === undefined) {
      throw new Error('Empty tool result stream');
    }
    return last;
  }
  return value;
}
