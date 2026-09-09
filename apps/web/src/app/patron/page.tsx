import type { Metadata } from 'next';
import { PatronPage } from '@/components/pages/patron/PatronPage';

export const metadata: Metadata = { title: 'Patron' };

export default function Page() {
  return <PatronPage />;
}
