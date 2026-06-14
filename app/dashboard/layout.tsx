import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard | Folkets Stemme',
  description: 'Utforsk saker, delta i høringer og følg med på demokratiet.',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
