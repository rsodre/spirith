'use client';

import { VAULT } from './contracts';
import { useChainMutation } from './use-chain-mutation';

// The patron's exit: a 30-day notice on some or all shares, then the withdrawal itself.
// Never blocked, only delayed; the contract's pause does not reach either call.
export function useRequestWithdrawFlow(label: string) {
  return useChainMutation<{ readonly shares: bigint }, boolean>(
    'SpirithVault::requestWithdraw()',
    async (tx, { shares }) => {
      const { receipt } = await tx.send('SpirithVault::requestWithdraw()', {
        ...VAULT,
        functionName: 'requestWithdraw',
        args: [label, shares],
      });
      return tx.indexing(receipt.blockNumber);
    },
  );
}

export function useExecuteWithdrawFlow(label: string) {
  return useChainMutation<void, boolean>('SpirithVault::executeWithdraw()', async tx => {
    const { receipt } = await tx.send('SpirithVault::executeWithdraw()', {
      ...VAULT,
      functionName: 'executeWithdraw',
      args: [label],
    });
    return tx.indexing(receipt.blockNumber);
  });
}
