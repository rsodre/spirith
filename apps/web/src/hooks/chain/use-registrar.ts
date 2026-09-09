'use client';

import { useReadContract } from 'wagmi';
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
