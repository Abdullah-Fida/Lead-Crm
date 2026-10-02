import { Page } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/ui/layout';

export const metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <Page>
      <PageHeader title="Dashboard" description="Coming together…" />
    </Page>
  );
}
