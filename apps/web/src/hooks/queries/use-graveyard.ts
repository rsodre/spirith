'use client';

import { useQuery } from '@tanstack/react-query';
import type { SubgraphName } from '@spirith/core';
import { fetchQuery } from '@/lib/api';

export interface GraveyardResponse {
  readonly now: bigint;
  readonly names: readonly SubgraphName[];
}

export function useGraveyard() {
  return useQuery({
    queryKey: ['graveyard'],
    queryFn: () => fetchQuery<GraveyardResponse>('graveyard'),
  });
}
