import { listCitizenOpinions, listSakPickerOptions } from '@/lib/opinions/service';
import { FolketsMeningerClient } from '@/components/opinions/folkets-meninger-client';

export const dynamic = 'force-dynamic';

export default async function FolketsMeningerPage() {
  const [opinions, sakOptions] = await Promise.all([
    listCitizenOpinions(40),
    listSakPickerOptions(300),
  ]);

  return <FolketsMeningerClient opinions={opinions} sakOptions={sakOptions} />;
}
