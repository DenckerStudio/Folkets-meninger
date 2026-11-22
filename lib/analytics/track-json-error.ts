import { NextResponse } from 'next/server';
import { trustedClientIp } from '@/lib/analytics/client-ip';
import { recordAppHttpError } from '@/lib/analytics/record-http-error';

/**
 * JSON error response that also records an anonymous app http_error (best-effort).
 * Use on selected public API routes (≥ 400).
 */
export function trackedJsonError(
  request: Request,
  body: unknown,
  status: number,
  init?: ResponseInit,
): NextResponse {
  if (status >= 400 && status <= 599) {
    const url = new URL(request.url);
    void recordAppHttpError({
      path: url.pathname,
      status,
      method: request.method,
      userAgent: request.headers.get('user-agent'),
      ip: trustedClientIp(request),
    });
  }

  return NextResponse.json(body, { ...init, status });
}
