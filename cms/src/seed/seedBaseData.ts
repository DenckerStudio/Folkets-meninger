import type { Payload } from 'payload';

export const DEFAULT_CATEGORIES = [
  { name: 'Voteringer', slug: 'voteringer', order: 1 },
  { name: 'Høringer', slug: 'horinger', order: 2 },
  { name: 'Forklart', slug: 'forklart', order: 3 },
  { name: 'Demokrati og deltakelse', slug: 'demokrati', order: 4 },
  { name: 'Om Folkets Meninger', slug: 'om-folkets-meninger', order: 5 },
];

export const DEFAULT_AUTHOR = {
  name: 'Redaksjonen i Folkets Meninger',
  slug: 'redaksjonen',
  kind: 'organization' as const,
  role: 'Redaksjon',
  bio: 'Redaksjonelt innhold fra Folkets Meninger.',
};

export type SeedResult = {
  adminCreated: boolean;
  categoriesCreated: number;
  authorCreated: boolean;
};

export class SeedConfigError extends Error {}

/** Reads and validates SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. Throws SeedConfigError if invalid. */
export function seedAdminFromEnv(
  env: Record<string, string | undefined> = process.env,
): {
  email: string;
  password: string;
} {
  const email = env.SEED_ADMIN_EMAIL?.trim();
  const password = env.SEED_ADMIN_PASSWORD?.trim();
  if (!email || !password) {
    throw new SeedConfigError(
      'Sett SEED_ADMIN_EMAIL og SEED_ADMIN_PASSWORD (minst 12 tegn) før seed.',
    );
  }
  if (password.length < 12) {
    throw new SeedConfigError('SEED_ADMIN_PASSWORD må være minst 12 tegn.');
  }
  return { email, password };
}

export async function seedTaxonomy(
  payload: Payload,
): Promise<Pick<SeedResult, 'categoriesCreated' | 'authorCreated'>> {
  const result = { categoriesCreated: 0, authorCreated: false };

  for (const cat of DEFAULT_CATEGORIES) {
    const found = await payload.find({
      collection: 'categories',
      where: { slug: { equals: cat.slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    if (found.docs.length === 0) {
      await payload.create({ collection: 'categories', data: cat, overrideAccess: true });
      result.categoriesCreated += 1;
    }
  }

  const authorFound = await payload.find({
    collection: 'authors',
    where: { slug: { equals: DEFAULT_AUTHOR.slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  if (authorFound.docs.length === 0) {
    await payload.create({ collection: 'authors', data: DEFAULT_AUTHOR, overrideAccess: true });
    result.authorCreated = true;
  }

  return result;
}

/**
 * Idempotent seed: admin user (only if no user with that email exists), default
 * categories and the default author (each only if its slug is missing).
 */
export async function seedBaseData(
  payload: Payload,
  admin: { email: string; password: string },
): Promise<SeedResult> {
  const result: SeedResult = { adminCreated: false, categoriesCreated: 0, authorCreated: false };

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: admin.email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  if (existing.docs.length === 0) {
    await payload.create({
      collection: 'users',
      data: {
        email: admin.email,
        password: admin.password,
        role: 'admin',
        name: 'Administrator',
      },
      overrideAccess: true,
    });
    result.adminCreated = true;
  }

  const taxonomy = await seedTaxonomy(payload);
  result.categoriesCreated = taxonomy.categoriesCreated;
  result.authorCreated = taxonomy.authorCreated;

  return result;
}

/**
 * Payload onInit hook: runs the idempotent seed when SEED_ON_BOOT=true.
 * Skips admin creation when any admin already exists; always ensures taxonomy.
 */
export async function seedOnBoot(payload: Payload): Promise<void> {
  if (process.env.SEED_ON_BOOT?.trim() !== 'true') return;
  try {
    const admins = await payload.find({
      collection: 'users',
      where: { role: { equals: 'admin' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });

    let result: SeedResult;
    if (admins.docs.length === 0) {
      const admin = seedAdminFromEnv();
      result = await seedBaseData(payload, admin);
    } else {
      const taxonomy = await seedTaxonomy(payload);
      result = { adminCreated: false, ...taxonomy };
    }

    payload.logger.info(
      `SEED_ON_BOOT: done (adminCreated=${result.adminCreated}, categoriesCreated=${result.categoriesCreated}, authorCreated=${result.authorCreated}). Set SEED_ON_BOOT=false and remove SEED_ADMIN_PASSWORD after first deploy.`,
    );
  } catch (error) {
    payload.logger.error({
      err: error,
      msg: `SEED_ON_BOOT failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
