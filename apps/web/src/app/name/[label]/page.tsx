import type { Metadata } from 'next';
import { NamePage } from '@/components/pages/name/NamePage';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ label: string }>;
}): Promise<Metadata> {
  const { label } = await params;
  return { title: `${decodeURIComponent(label)}.eth` };
}

export default function Page() {
  return <NamePage />;
}
