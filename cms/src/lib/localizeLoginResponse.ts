import {
  ACCOUNT_LOCKOUT_MESSAGE_NB,
  PAYLOAD_USER_LOCKED_EN,
} from '@/lib/loginMessages';

type PayloadErrorShape = { message?: string };

/** Rewrite Payload login error messages to Norwegian bokmål where applicable. */
export async function localizeLoginResponse(response: Response): Promise<Response> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return response;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return response;
  }

  if (!body || typeof body !== 'object' || !('errors' in body)) {
    return response;
  }

  const errors = (body as { errors?: PayloadErrorShape[] }).errors;
  if (!Array.isArray(errors)) {
    return response;
  }

  let changed = false;
  const localized = errors.map((err) => {
    const message = err?.message;
    if (
      message === PAYLOAD_USER_LOCKED_EN ||
      (typeof message === 'string' && message.toLowerCase().includes('locked'))
    ) {
      changed = true;
      return { ...err, message: ACCOUNT_LOCKOUT_MESSAGE_NB };
    }
    return err;
  });

  const headers = new Headers(response.headers);
  if (!changed) {
    return Response.json(body, { status: response.status, headers });
  }

  return Response.json({ ...body, errors: localized }, { status: response.status, headers });
}
