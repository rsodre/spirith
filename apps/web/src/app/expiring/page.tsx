import type { Metadata } from 'next';
import { ExpiringPage } from '@/components/pages/expiring/ExpiringPage';

export const metadata: Metadata = { title: 'Expiring' };

export default function Page() {
  return <ExpiringPage />;
}
