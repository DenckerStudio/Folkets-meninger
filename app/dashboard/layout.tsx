import type { Metadata } from 'next';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export const metadata: Metadata = {
  title: {
    template: '%s | Folkets Stemme',
    default: 'Dashboard | Folkets Stemme',
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
