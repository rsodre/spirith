'use client';

import { useQuery } from '@tanstack/react-query';
import type { SubgraphEndowment, SubgraphName } from '@spirith/core';
import { fetchQuery } from '@/lib/api';

export interface EndowmentsResponse {
  readonly now: bigint;
  readonly endowments: readonly (SubgraphEndowment & { readonly name: SubgraphName })[];
}

export function useEndowments() {
  return useQuery({
    queryKey: ['endowments'],
    queryFn: () => fetchQuery<EndowmentsResponse>('endowments'),
  });
}
