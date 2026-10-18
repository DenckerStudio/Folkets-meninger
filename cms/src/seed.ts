import { getPayload } from 'payload';
import config from '@payload-config';

async function seed() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();
  if (!email || !password) {
    console.error('Sett SEED_ADMIN_EMAIL og SEED_ADMIN_PASSWORD (minst 12 tegn) før seed.');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('SEED_ADMIN_PASSWORD må være minst 12 tegn.');
    process.exit(1);
  }

  const payload = await getPayload({ config });

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
  });
  if (existing.docs.length > 0) {
    console.log('Admin finnes allerede:', email);
    process.exit(0);
  }

  await payload.create({
    collection: 'users',
    data: {
      email,
      password,
      role: 'admin',
      name: 'Administrator',
    },
  });

  const categories = [
    { name: 'Voteringer', slug: 'voteringer', order: 1 },
    { name: 'Høringer', slug: 'horinger', order: 2 },
    { name: 'Forklart', slug: 'forklart', order: 3 },
    { name: 'Demokrati og deltakelse', slug: 'demokrati', order: 4 },
    { name: 'Om Folkets Meninger', slug: 'om-folkets-meninger', order: 5 },
  ];

  for (const cat of categories) {
    const found = await payload.find({
      collection: 'categories',
      where: { slug: { equals: cat.slug } },
      limit: 1,
    });
    if (found.docs.length === 0) {
      await payload.create({ collection: 'categories', data: cat });
    }
  }

  const authorFound = await payload.find({
    collection: 'authors',
    where: { slug: { equals: 'redaksjonen' } },
    limit: 1,
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
    });
  }

  console.log('Seed fullført for', email);
  process.exit(0);
}

void seed();
