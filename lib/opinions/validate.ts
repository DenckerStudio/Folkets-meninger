import {
  OPINION_BODY_MAX,
  OPINION_BODY_MIN,
  OPINION_CREATE_STANCES,
  OPINION_POINTS_MAX,
  OPINION_POINTS_MIN,
  OPINION_POINT_STANCES,
  OPINION_POINT_TEXT_MAX,
  OPINION_POINT_TEXT_MIN,
  OPINION_REPLY_BODY_MIN,
  OPINION_STANCES,
  OPINION_TITLE_MAX,
  OPINION_TITLE_MIN,
  type OpinionCreateStance,
  type OpinionPoint,
  type OpinionPointStance,
  type OpinionStance,
} from './types';

export function isOpinionStance(value: unknown): value is OpinionStance {
  return typeof value === 'string' && (OPINION_STANCES as readonly string[]).includes(value);
}

export function isOpinionCreateStance(value: unknown): value is OpinionCreateStance {
  return typeof value === 'string' && (OPINION_CREATE_STANCES as readonly string[]).includes(value);
}

export function isOpinionPointStance(value: unknown): value is OpinionPointStance {
  return typeof value === 'string' && (OPINION_POINT_STANCES as readonly string[]).includes(value);
}

export function requiresOpinionBody(stance: unknown): boolean {
  return isOpinionStance(stance) && stance !== 'blank';
}

export type OpinionFieldErrors = {
  title?: string;
  body?: string;
  stance?: string;
  points?: string;
};

function normalizePointText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function parseOpinionPoints(value: unknown): OpinionPoint[] {
  if (!Array.isArray(value)) return [];
  const points: OpinionPoint[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as { stance?: unknown; text?: unknown };
    if (!isOpinionPointStance(record.stance)) continue;
    const text = normalizePointText(record.text);
    if (!text) continue;
    points.push({ stance: record.stance, text });
  }
  return points;
}

export function validateOpinionPoints(value: unknown): { points: OpinionPoint[]; error?: string } {
  const points = parseOpinionPoints(value);
  if (points.length < OPINION_POINTS_MIN) {
    return {
      points,
      error: `Del minst ${OPINION_POINTS_MIN} kulepunkter merket For eller Imot.`,
    };
  }
  if (points.length > OPINION_POINTS_MAX) {
    return {
      points,
      error: `Du kan dele maks ${OPINION_POINTS_MAX} kulepunkter.`,
    };
  }

  const tooShort = points.find((point) => point.text.length < OPINION_POINT_TEXT_MIN);
  if (tooShort) {
    return {
      points,
      error: `Hvert kulepunkt må være minst ${OPINION_POINT_TEXT_MIN} tegn.`,
    };
  }

  const tooLong = points.find((point) => point.text.length > OPINION_POINT_TEXT_MAX);
  if (tooLong) {
    return {
      points,
      error: `Hvert kulepunkt kan være maks ${OPINION_POINT_TEXT_MAX} tegn.`,
    };
  }

  const hasFor = points.some((point) => point.stance === 'for');
  const hasImot = points.some((point) => point.stance === 'imot');
  if (!hasFor || !hasImot) {
    return {
      points,
      error: 'Ta med minst ett punkt for og ett punkt imot.',
    };
  }

  return { points };
}

export function emptyOpinionPointDrafts(): OpinionPoint[] {
  return [
    { stance: 'for', text: '' },
    { stance: 'imot', text: '' },
    { stance: 'for', text: '' },
  ];
}

export function validateOpinionDraft(input: {
  title: string;
  body: string;
  stance: unknown;
  points?: unknown;
}): OpinionFieldErrors {
  const errors: OpinionFieldErrors = {};
  const title = input.title.trim();
  const body = input.body.trim();

  if (title.length < OPINION_TITLE_MIN) {
    errors.title = `Tittelen må være minst ${OPINION_TITLE_MIN} tegn`;
  } else if (title.length > OPINION_TITLE_MAX) {
    errors.title = `Tittelen kan ikke være lengre enn ${OPINION_TITLE_MAX} tegn`;
  }

  if (body.length > OPINION_BODY_MAX) {
    errors.body = `Begrunnelsen kan ikke være lengre enn ${OPINION_BODY_MAX} tegn`;
  } else if (requiresOpinionBody(input.stance) && body.length < OPINION_BODY_MIN) {
    errors.body = `Begrunnelsen må være minst ${OPINION_BODY_MIN} tegn`;
  }

  if (!isOpinionCreateStance(input.stance)) {
    errors.stance = 'Velg For eller Imot';
  }

  const pointsResult = validateOpinionPoints(input.points);
  if (pointsResult.error) {
    errors.points = pointsResult.error;
  }

  return errors;
}

export function validateReplyDraft(input: { body: string; stance: unknown }): OpinionFieldErrors {
  const errors: OpinionFieldErrors = {};
  const body = input.body.trim();

  if (body.length > OPINION_BODY_MAX) {
    errors.body = `Begrunnelsen kan ikke være lengre enn ${OPINION_BODY_MAX} tegn`;
  } else if (requiresOpinionBody(input.stance) && body.length < OPINION_REPLY_BODY_MIN) {
    errors.body = `Begrunnelsen må være minst ${OPINION_REPLY_BODY_MIN} tegn`;
  }

  if (!isOpinionStance(input.stance)) {
    errors.stance = 'Velg For, Blank eller Imot';
  }

  return errors;
}


export function describeOpinionComposerGaps(input: {
  issueId: string | null;
  stance: unknown;
  body: string;
  points: unknown;
}): string {
  const sentences: string[] = [];
  const needsSak = !input.issueId?.trim();
  const needsStance = !isOpinionCreateStance(input.stance);

  if (needsSak && needsStance) {
    sentences.push('Velg en sak, deretter For eller Imot.');
  } else if (needsSak) {
    sentences.push('Velg en sak.');
  } else if (needsStance) {
    sentences.push('Velg For eller Imot.');
  }

  const bodyLength = input.body.trim().length;
  const remaining = OPINION_BODY_MIN - bodyLength;
  if (remaining > 0) {
    sentences.push(`${remaining} tegn igjen til minstekravet.`);
  }

  const points = parseOpinionPoints(input.points);
  const hasFor = points.some(
    (point) => point.stance === 'for' && point.text.length >= OPINION_POINT_TEXT_MIN,
  );
  const hasImot = points.some(
    (point) => point.stance === 'imot' && point.text.length >= OPINION_POINT_TEXT_MIN,
  );
  if (!hasFor && !hasImot) {
    sentences.push('Ta med minst ett punkt for og ett punkt imot.');
  } else if (!hasFor) {
    sentences.push('Ta med minst ett punkt for.');
  } else if (!hasImot) {
    sentences.push('Ta med minst ett punkt imot.');
  }

  const shortCount = points.filter((point) => point.text.length < OPINION_POINT_TEXT_MIN).length;
  if (shortCount === 1) {
    sentences.push(`Ett kulepunkt er under ${OPINION_POINT_TEXT_MIN} tegn.`);
  } else if (shortCount > 1) {
    sentences.push(`${shortCount} kulepunkter er under ${OPINION_POINT_TEXT_MIN} tegn.`);
  }

  return sentences.join(' ');
}

export function hasOpinionFieldErrors(errors: OpinionFieldErrors): boolean {
  return Boolean(errors.title || errors.body || errors.stance || errors.points);
}
