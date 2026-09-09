'use client';

import { useQuery } from '@tanstack/react-query';
import type { SubgraphName } from '@spirith/core';
import type { Address } from 'viem';
import { fetchQuery } from '@/lib/api';

export interface OwnedNamesResponse {
  readonly now: bigint;
  readonly names: readonly SubgraphName[];
}

export function useOwnedNames(address: Address | undefined) {
  return useQuery({
    queryKey: ['owned', address],
    queryFn: () => fetchQuery<OwnedNamesResponse>(`owned/${address}`),
    enabled: address !== undefined,
  });
}
