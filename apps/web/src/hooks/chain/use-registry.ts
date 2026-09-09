'use client';

import { useReadContract } from 'wagmi';
import { REGISTRY } from './contracts';

// ENSv2 `.eth` registry reads. The name card takes expiry, owner and resolver from here, not
// from the subgraph, so an indexing lag never shows a stale name.
export function useNameExpiry(label: string) {
  const q = useReadContract({
    ...REGISTRY,
    functionName: 'findExpiry',
    args: [label],
    query: { enabled: label.length > 0 },
  });
  return { expiry: q.data, isLoading: q.isLoading, error: q.error };
}

export function useNameOwner(label: string) {
  const q = useReadContract({
    ...REGISTRY,
    functionName: 'findOwner',
    args: [label],
    query: { enabled: label.length > 0 },
  });
  return { owner: q.data, isLoading: q.isLoading };
}

export function useNameResolver(label: string) {
  const q = useReadContract({
    ...REGISTRY,
    functionName: 'getResolver',
    args: [label],
    query: { enabled: label.length > 0 },
  });
  return { resolver: q.data, isLoading: q.isLoading };
}
