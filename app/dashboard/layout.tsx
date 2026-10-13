import type { Metadata } from 'next';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export const metadata: Metadata = {
  title: 'Dashboard | Folkets Meninger',
  description: 'Folkets meninger, saker, avstemninger og høringer.',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
