import type { Payload } from 'payload';

const DEFAULT_CATEGORIES = [
  { name: 'Voteringer', slug: 'voteringer', order: 1 },
  { name: 'Høringer', slug: 'horinger', order: 2 },
  { name: 'Forklart', slug: 'forklart', order: 3 },
  { name: 'Demokrati og deltakelse', slug: 'demokrati', order: 4 },
  { name: 'Om Folkets Meninger', slug: 'om-folkets-meninger', order: 5 },
];

export async function runSeedOnBoot(payload: Payload): Promise<void> {
  if (process.env.SEED_ON_BOOT !== 'true') return;

  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();
  if (!email || !password) {
    payload.logger.warn('SEED_ON_BOOT: mangler SEED_ADMIN_EMAIL eller SEED_ADMIN_PASSWORD');
    return;
  }
  if (password.length < 12) {
    payload.logger.warn('SEED_ON_BOOT: SEED_ADMIN_PASSWORD må være minst 12 tegn');
    return;
  }

  const admins = await payload.find({
    collection: 'users',
    where: { role: { equals: 'admin' } },
    limit: 1,
    overrideAccess: true,
  });

  if (admins.docs.length === 0) {
    const existingEmail = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    });
    if (existingEmail.docs.length === 0) {
      await payload.create({
        collection: 'users',
        data: {
          email,
          password,
          role: 'admin',
          name: 'Administrator',
        },
        overrideAccess: true,
      });
      payload.logger.info({ msg: 'SEED_ON_BOOT: opprettet admin', email });
    }
  }

  for (const cat of DEFAULT_CATEGORIES) {
    const found = await payload.find({
      collection: 'categories',
      where: { slug: { equals: cat.slug } },
      limit: 1,
      overrideAccess: true,
    });
    if (found.docs.length === 0) {
      await payload.create({ collection: 'categories', data: cat, overrideAccess: true });
    }
  }

  const authorFound = await payload.find({
    collection: 'authors',
    where: { slug: { equals: 'redaksjonen' } },
    limit: 1,
    overrideAccess: true,
  });
  if (authorFound.docs.length === 0) {
    await payload.create({
      collection: 'authors',
      data: {
        name: 'Redaksjonen i Folkets Meninger',
        slug: 'redaksjonen',
        kind: 'organization',
        role: 'Redaksjon',
        bio: 'Redaksjonelt innhold fra Folkets Meninger.',
      },
      overrideAccess: true,
    });
  }
}
