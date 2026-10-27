/** `process.env.NODE_ENV` is read-only in newer `@types/node`; tests may still override it. */
export function setNodeEnvForTest(value: string): void {
  (process.env as { NODE_ENV?: string }).NODE_ENV = value;
}
