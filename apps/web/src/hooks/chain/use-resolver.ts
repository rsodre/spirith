'use client';

import { useMemo } from 'react';
import type { Address } from 'viem';
import { useReadContracts } from 'wagmi';
import { SPIRITH_RECORDS } from '@spirith/core';
import { nameNode } from '@/lib/dns';
import { ZERO_ADDRESS, resolverContract } from './contracts';

export interface SpirithRecords {
  /** Unix seconds as written by the vault, or null when unset or unreadable. */
  readonly fundedUntil: bigint | null;
  readonly patrons: number | null;
  /** The resolver answered `text()` at all; false for a resolver without records. */
  readonly supported: boolean;
}

/** The two `spirith.*` text records on a name's resolver, straight from the chain. */
export function useSpirithRecords(label: string, resolver: Address | undefined) {
  const enabled = label.length > 0 && resolver !== undefined && resolver !== ZERO_ADDRESS;
  const contracts = useMemo(() => {
    if (!enabled) return undefined;
    const ref = resolverContract(resolver);
    const node = nameNode(label);
    return [
      { ...ref, functionName: 'text', args: [node, SPIRITH_RECORDS.fundedUntil] },
      { ...ref, functionName: 'text', args: [node, SPIRITH_RECORDS.patrons] },
    ] as const;
  }, [enabled, label, resolver]);
  const q = useReadContracts({ contracts, allowFailure: true, query: { enabled } });
  const records = useMemo<SpirithRecords | undefined>(() => {
    if (!q.data) return undefined;
    const [funded, patrons] = q.data;
    const supported = funded.status === 'success' && patrons.status === 'success';
    const fundedText = funded.status === 'success' ? funded.result : '';
    const patronsText = patrons.status === 'success' ? patrons.result : '';
    return {
      fundedUntil: /^\d+$/.test(fundedText) ? BigInt(fundedText) : null,
      patrons: /^\d+$/.test(patronsText) ? Number(patronsText) : null,
      supported,
    };
  }, [q.data]);
  return { records, isLoading: enabled && q.isLoading };
}

export interface RecordTarget {
  readonly label: string;
  readonly resolver: Address | null;
}

/** `spirith.funded-until` for many names in one multicall; a name whose resolver has no
 * record, or no resolver, maps to null. Keyed by label. */
export function useSpirithFundedUntilMany(targets: readonly RecordTarget[]) {
  const readable = useMemo(
    () => targets.filter(t => t.resolver !== null && t.resolver !== ZERO_ADDRESS),
    [targets],
  );
  const contracts = useMemo(
    () =>
      readable.map(t => ({
        ...resolverContract(t.resolver as Address),
        functionName: 'text' as const,
        args: [nameNode(t.label), SPIRITH_RECORDS.fundedUntil] as const,
      })),
    [readable],
  );
  const q = useReadContracts({
    contracts,
    allowFailure: true,
    query: { enabled: contracts.length > 0 },
  });
  const fundedUntil = useMemo(() => {
    const map = new Map<string, bigint | null>();
    for (const t of targets) map.set(t.label, null);
    q.data?.forEach((r, i) => {
      const t = readable[i];
      if (t && r.status === 'success' && /^\d+$/.test(r.result)) map.set(t.label, BigInt(r.result));
    });
    return map;
  }, [q.data, readable, targets]);
  return { fundedUntil, isLoading: contracts.length > 0 && q.isLoading };
}
