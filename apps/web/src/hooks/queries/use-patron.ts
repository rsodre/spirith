'use client';

import { useQuery } from '@tanstack/react-query';
import type { SubgraphPatron } from '@spirith/core';
import type { Address } from 'viem';
import { fetchQuery } from '@/lib/api';

export interface PatronResponse {
  readonly patron: SubgraphPatron | null;
}

export function usePatron(address: Address | undefined) {
  return useQuery({
    queryKey: ['patron', address],
    queryFn: () => fetchQuery<PatronResponse>(`patron/${address}`),
    enabled: address !== undefined,
  });
}
