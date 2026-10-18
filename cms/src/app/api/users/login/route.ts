import { REST_POST } from '@payloadcms/next/routes';
import config from '@payload-config';
import { checkLoginRateLimit } from '@/lib/loginRateLimit';

const payloadPost = REST_POST(config);

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown';
}

export async function POST(request: Request) {
  const limit = checkLoginRateLimit(clientIp(request));
  if (!limit.allowed) {
    return Response.json(
      {
        errors: [
          { message: 'For mange innloggingsforsøk fra denne IP-adressen. Prøv igjen senere.' },
        ],
      },
      {
        status: 429,
        headers: limit.retryAfterSec ? { 'Retry-After': String(limit.retryAfterSec) } : undefined,
      },
    );
  }

  return payloadPost(request, { params: Promise.resolve({ slug: ['users', 'login'] }) });
}
