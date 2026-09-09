import type { Metadata } from 'next';
import { DevelopersPage } from '@/components/pages/developers/DevelopersPage';

export const metadata: Metadata = { title: 'Developers' };

export default function Page() {
  return <DevelopersPage />;
}
