import { getPayload } from 'payload';
import config from '@payload-config';
import { SeedConfigError, seedAdminFromEnv, seedBaseData } from '@/seed/seedBaseData';

async function seed() {
  let admin: { email: string; password: string };
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
  if (!result.adminCreated) console.log('Admin finnes allerede:', admin.email);
  console.log('Seed fullført for', admin.email, result);
  process.exit(0);
}

void seed();
