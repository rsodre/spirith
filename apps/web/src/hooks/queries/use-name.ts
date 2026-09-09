'use client';

import { useQuery } from '@tanstack/react-query';
import type { SubgraphNameDetail } from '@spirith/core';
import { fetchQuery } from '@/lib/api';

export interface NameResponse {
  readonly name: SubgraphNameDetail | null;
}

export function fetchNameQuery(label: string): Promise<NameResponse> {
  return fetchQuery<NameResponse>(`name/${encodeURIComponent(label)}`);
}

export function useName(label: string) {
  return useQuery({
    queryKey: ['name', label],
    queryFn: () => fetchNameQuery(label),
    enabled: label.length > 0,
  });
}
