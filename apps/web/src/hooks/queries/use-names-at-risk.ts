'use client';

import { useQuery } from '@tanstack/react-query';
import type { SubgraphName } from '@spirith/core';
import { fetchQuery } from '@/lib/api';

export interface NamesAtRiskResponse {
  readonly now: bigint;
  readonly days: number;
  readonly names: readonly SubgraphName[];
}

export function useNamesAtRisk(days: number) {
  return useQuery({
    queryKey: ['names_at_risk', days],
    queryFn: () => fetchQuery<NamesAtRiskResponse>(`names_at_risk?days=${days}`),
  });
}
