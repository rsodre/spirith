'use client';

import type { Address } from 'viem';
import { useReadContract } from 'wagmi';
import { USDC, VAULT } from './contracts';

/** MockUSDC balance of an account; refreshed on every write through `invalidateAll`. */
export function useUsdcBalance(account: Address | undefined) {
  const q = useReadContract({
    ...USDC,
    functionName: 'balanceOf',
    args: account ? [account] : undefined,
    query: { enabled: account !== undefined },
  });
  return { balance: q.data, isLoading: q.isLoading };
}

/** What the vault may pull from an account. */
export function useUsdcAllowance(account: Address | undefined) {
  const q = useReadContract({
    ...USDC,
    functionName: 'allowance',
    args: account ? [account, VAULT.address] : undefined,
    query: { enabled: account !== undefined },
  });
  return { allowance: q.data, isLoading: q.isLoading };
}
