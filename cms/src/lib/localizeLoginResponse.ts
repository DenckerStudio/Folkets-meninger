import {
  ACCOUNT_LOCKOUT_MESSAGE_NB,
  LOGIN_CREDENTIALS_WRONG_MESSAGE_NB,
  PAYLOAD_EMAIL_PASSWORD_INCORRECT_EN,
  PAYLOAD_USER_LOCKED_EN,
  PAYLOAD_USERNAME_PASSWORD_INCORRECT_EN,
} from '@/lib/loginMessages';

type PayloadErrorShape = { message?: string };

function responseWithJsonBody(body: unknown, response: Response): Response {
  const headers = new Headers(response.headers);
  return Response.json(body, { status: response.status, headers });
}

function localizeErrorMessage(message: string | undefined): string | undefined {
  if (!message) return message;
  if (
    message === PAYLOAD_USER_LOCKED_EN ||
    message.toLowerCase().includes('locked')
  ) {
    return ACCOUNT_LOCKOUT_MESSAGE_NB;
  }
  if (
    message === PAYLOAD_EMAIL_PASSWORD_INCORRECT_EN ||
    message === PAYLOAD_USERNAME_PASSWORD_INCORRECT_EN
  ) {
    return LOGIN_CREDENTIALS_WRONG_MESSAGE_NB;
  }
  return message;
}

/** Rewrite Payload login responses; always returns a fresh Response with headers preserved. */
export async function localizeLoginResponse(response: Response): Promise<Response> {
  const headers = new Headers(response.headers);
  const status = response.status;
  const contentType = headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    return new Response(response.body, { status, headers });
  }

  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return new Response(response.body, { status, headers });
  }

  if (!body || typeof body !== 'object' || !('errors' in body)) {
    return responseWithJsonBody(body, response);
  }

  const errors = (body as { errors?: PayloadErrorShape[] }).errors;
  if (!Array.isArray(errors)) {
    return responseWithJsonBody(body, response);
  }

  let changed = false;
  const localized = errors.map((err) => {
    const nextMessage = localizeErrorMessage(err?.message);
    if (nextMessage !== err?.message) {
      changed = true;
      return { ...err, message: nextMessage };
    }
    return err;
  });

  if (!changed) {
    return responseWithJsonBody(body, response);
  }

  return responseWithJsonBody({ ...body, errors: localized }, response);
}
