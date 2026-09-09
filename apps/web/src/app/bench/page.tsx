import type { Metadata } from 'next';
import { BenchPage } from '@/components/pages/bench/BenchPage';

export const metadata: Metadata = { title: 'Bench', robots: { index: false } };

export default function Page() {
  return <BenchPage />;
}
