'use client';

import { useQuery } from '@tanstack/react-query';
import type { SubgraphMeta, SubgraphNamespace } from '@spirith/core';
import { fetchQuery } from '@/lib/api';

export interface NamespaceResponse {
  readonly namespace: SubgraphNamespace | null;
  readonly meta: SubgraphMeta;
}

export const NAMESPACE_KEY = ['namespace'] as const;

export function fetchNamespaceQuery(): Promise<NamespaceResponse> {
  return fetchQuery<NamespaceResponse>('namespace');
}

export function useNamespace() {
  return useQuery({ queryKey: NAMESPACE_KEY, queryFn: fetchNamespaceQuery });
}
