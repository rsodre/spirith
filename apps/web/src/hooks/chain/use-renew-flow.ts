'use client';

import { readContract } from 'wagmi/actions';
import { wagmiConfig } from '@/lib/wagmi';
import { VAULT } from './contracts';
import { useChainMutation } from './use-chain-mutation';

// Anyone may call. The duration is read fresh from the vault's own heuristic right before
// sending, because `renew()` accepts exactly that duration and nothing else.
export function useRenewFlow(label: string) {
  return useChainMutation<void, boolean>('SpirithVault::renew()', async tx => {
    const [, , assets, duration] = await readContract(wagmiConfig, {
      ...VAULT,
      functionName: 'runwayOf',
      args: [label],
    });
    if (duration === 0n) {
      throw new Error(
        `The earmark holds too little for one year (${assets} units). Endow it first.`,
      );
    }
    const { receipt } = await tx.send('SpirithVault::renew()', {
      ...VAULT,
      functionName: 'renew',
      args: [label, duration],
    });
    return tx.indexing(receipt.blockNumber);
  });
}
