import {
  OPINION_BODY_MAX,
  OPINION_BODY_MIN,
  OPINION_REPLY_BODY_MIN,
  OPINION_STANCES,
  OPINION_TITLE_MAX,
  OPINION_TITLE_MIN,
  type OpinionStance,
} from './types';

export function isOpinionStance(value: unknown): value is OpinionStance {
  return typeof value === 'string' && (OPINION_STANCES as readonly string[]).includes(value);
}

export type OpinionFieldErrors = {
  title?: string;
  body?: string;
  stance?: string;
};

export function validateOpinionDraft(input: {
  title: string;
  body: string;
  stance: unknown;
}): OpinionFieldErrors {
  const errors: OpinionFieldErrors = {};
  const title = input.title.trim();
  const body = input.body.trim();

  if (title.length < OPINION_TITLE_MIN) {
    errors.title = `Tittelen må være minst ${OPINION_TITLE_MIN} tegn`;
  } else if (title.length > OPINION_TITLE_MAX) {
    errors.title = `Tittelen kan ikke være lengre enn ${OPINION_TITLE_MAX} tegn`;
  }

  if (body.length < OPINION_BODY_MIN) {
    errors.body = `Begrunnelsen må være minst ${OPINION_BODY_MIN} tegn`;
  } else if (body.length > OPINION_BODY_MAX) {
    errors.body = `Begrunnelsen kan ikke være lengre enn ${OPINION_BODY_MAX} tegn`;
  }

  if (!isOpinionStance(input.stance)) {
    errors.stance = 'Velg For, Blank eller Imot';
  }

  return errors;
}

export function validateReplyDraft(input: { body: string; stance: unknown }): OpinionFieldErrors {
  const errors: OpinionFieldErrors = {};
  const body = input.body.trim();

  if (body.length < OPINION_REPLY_BODY_MIN) {
    errors.body = `Begrunnelsen må være minst ${OPINION_REPLY_BODY_MIN} tegn`;
  } else if (body.length > OPINION_BODY_MAX) {
    errors.body = `Begrunnelsen kan ikke være lengre enn ${OPINION_BODY_MAX} tegn`;
  }

  if (!isOpinionStance(input.stance)) {
    errors.stance = 'Velg For, Blank eller Imot';
  }

  return errors;
}

export function hasOpinionFieldErrors(errors: OpinionFieldErrors): boolean {
  return Boolean(errors.title || errors.body || errors.stance);
}
