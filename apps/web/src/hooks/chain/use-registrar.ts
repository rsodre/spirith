'use client';

import { useMemo } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';
import { REGISTRAR, USDC } from './contracts';

// ENSv2 registrar reads: renewability and the discounted price the vault will pay.
export function useIsRenewable(label: string) {
  const q = useReadContract({
    ...REGISTRAR,
    functionName: 'isRenewable',
    args: [label],
    query: { enabled: label.length > 0 },
  });
  return { isRenewable: q.data, isLoading: q.isLoading };
}

export function useRenewPrice(label: string, duration: bigint | undefined) {
  const enabled = label.length > 0 && duration !== undefined && duration > 0n;
  const q = useReadContract({
    ...REGISTRAR,
    functionName: 'getRenewPrice',
    args: [label, duration ?? 0n, USDC.address],
    query: { enabled },
  });
  return { price: enabled ? q.data : undefined, isLoading: enabled && q.isLoading };
}

/** Whether the registrar would accept a registration for `label` right now. */
export function useIsAvailable(label: string) {
  const q = useReadContract({
    ...REGISTRAR,
    functionName: 'isAvailable',
    args: [label],
    query: { enabled: label.length >= 3 },
  });
  return { isAvailable: label.length >= 3 ? q.data : undefined, isLoading: q.isLoading };
}

/** Registration price in USDC units: base plus any expiry premium. */
export function useRegisterPrice(label: string, duration: bigint) {
  const enabled = label.length >= 3 && duration > 0n;
  const q = useReadContract({
    ...REGISTRAR,
    functionName: 'getRegisterPrice',
    args: [label, duration, USDC.address],
    query: { enabled },
  });
  const price = enabled && q.data ? { base: q.data[0], premium: q.data[1] } : undefined;
  return { price, isLoading: enabled && q.isLoading, error: enabled ? q.error : null };
}

const REGISTRAR_CONSTANT_READS = [
  { ...REGISTRAR, functionName: 'MIN_COMMITMENT_AGE' },
  { ...REGISTRAR, functionName: 'MIN_REGISTER_DURATION' },
] as const;

/** The registrar's commit-reveal timing and minimum term; fetched once. */
export function useRegistrarConstants() {
  const q = useReadContracts({
    contracts: REGISTRAR_CONSTANT_READS,
    allowFailure: false,
    query: { staleTime: Number.POSITIVE_INFINITY },
  });
  return {
    constants: q.data ? { minCommitmentAge: q.data[0], minRegisterDuration: q.data[1] } : undefined,
    isLoading: q.isLoading,
  };
}

export interface RegisterQuote {
  readonly base: bigint;
  readonly premium: bigint;
}

/** `getRegisterPrice` for several terms in one multicall, in the order given. */
export function useRegisterPrices(label: string, durations: readonly bigint[]) {
  const enabled = label.length >= 3;
  const contracts = useMemo(
    () =>
      enabled
        ? durations.map(duration => ({
            ...REGISTRAR,
            functionName: 'getRegisterPrice' as const,
            args: [label, duration, USDC.address] as const,
          }))
        : [],
    [enabled, label, durations],
  );
  const q = useReadContracts({ contracts, allowFailure: true, query: { enabled } });
  const quotes = useMemo<readonly (RegisterQuote | undefined)[]>(
    () =>
      durations.map((_, i) => {
        const r = q.data?.[i];
        return r?.status === 'success' ? { base: r.result[0], premium: r.result[1] } : undefined;
      }),
    [q.data, durations],
  );
  return { quotes, isLoading: enabled && q.isLoading };
}
