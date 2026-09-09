import type { Metadata } from 'next';
import { GraveyardPage } from '@/components/pages/graveyard/GraveyardPage';

export const metadata: Metadata = { title: 'Graveyard' };

export default function Page() {
  return <GraveyardPage />;
}
