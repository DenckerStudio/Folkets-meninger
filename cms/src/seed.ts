import { getPayload } from 'payload';
import config from '@payload-config';
import { seedAdminFromEnv, seedBaseData, SeedConfigError } from '@/seed/seedBaseData';

async function seed() {
  let admin: ReturnType<typeof seedAdminFromEnv>;
  try {
    admin = seedAdminFromEnv();
  } catch (error) {
    if (error instanceof SeedConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
  const payload = await getPayload({ config });
  const result = await seedBaseData(payload, admin);
  console.log(
    `Seed fullført for ${admin.email} (adminCreated=${result.adminCreated}, categories=${result.categoriesCreated}, author=${result.authorCreated})`,
  );
  process.exit(0);
}

void seed();
