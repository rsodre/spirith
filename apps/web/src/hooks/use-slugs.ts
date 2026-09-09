'use client';

import { useParams } from 'next/navigation';

/** Route params, read in one place. `label` is the bare label, never with `.eth`. */
export function useSlugs(): { label: string } {
  const params = useParams<{ label?: string }>();
  const raw = params.label ?? '';
  const label = decodeURIComponent(raw)
    .replace(/\.eth$/i, '')
    .toLowerCase();
  return { label };
}
