export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { ForgotPasswordClient } from './forgot-password-client';

export const metadata: Metadata = {
  title: 'Glemt passord',
  robots: { index: false, follow: false },
};

export default function GlemtPassordPage() {
  return <ForgotPasswordClient />;
}
