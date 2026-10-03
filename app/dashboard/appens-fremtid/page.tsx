import { AppensFremtidPage } from '@/components/appens-fremtid/appens-fremtid-page';
import { APPENS_FREMTID_TITLE } from '@/lib/appens-fremtid/constants';

export const metadata = {
  title: APPENS_FREMTID_TITLE,
  description: 'Forslag, endringslogg og veikart for Folkets Stemme.',
};

export default function AppensFremtidRoutePage() {
  return <AppensFremtidPage />;
}
