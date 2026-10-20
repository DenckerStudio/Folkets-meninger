import { REST_POST } from '@payloadcms/next/routes';
import config from '@payload-config';
import { loginIdentifierFromBody } from '@/lib/loginBody';
import { checkLoginRateLimit } from '@/lib/loginRateLimit';
import { LOGIN_IP_RATE_LIMIT_MESSAGE_NB } from '@/lib/loginMessages';
import { localizeLoginResponse } from '@/lib/localizeLoginResponse';
import { trustedClientIp } from '@/lib/trustedClientIp';

const payloadPost = REST_POST(config);

export async function POST(request: Request) {
  const bodyText = await request.text();
  let identifier = '';
  try {
    identifier = loginIdentifierFromBody(JSON.parse(bodyText) as unknown);
  } catch {
    identifier = '';
  }

  const ip = trustedClientIp(request);
  const limit = checkLoginRateLimit(ip, identifier);
  if (!limit.allowed) {
    return Response.json(
      {
        errors: [{ message: LOGIN_IP_RATE_LIMIT_MESSAGE_NB }],
      },
      {
        status: 429,
        headers: limit.retryAfterSec ? { 'Retry-After': String(limit.retryAfterSec) } : undefined,
      },
    );
  }

  const loginRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: bodyText,
  });

  const response = await payloadPost(loginRequest, {
    params: Promise.resolve({ slug: ['users', 'login'] }),
  });
  return localizeLoginResponse(response);
}
