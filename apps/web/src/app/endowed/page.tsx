import type { Metadata } from 'next';
import { EndowedPage } from '@/components/pages/endowed/EndowedPage';

export const metadata: Metadata = { title: 'Endowed' };

export default function Page() {
  return <EndowedPage />;
}
