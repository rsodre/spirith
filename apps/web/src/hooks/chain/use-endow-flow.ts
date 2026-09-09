'use client';

import { readContract } from 'wagmi/actions';
import { wagmiConfig } from '@/lib/wagmi';
import { USDC, VAULT } from './contracts';
import { useChainMutation } from './use-chain-mutation';

export interface EndowArgs {
  readonly amount: bigint;
}

// Mint test USDC if short → approve if short → endow → wait for the subgraph. Balance and
// allowance are read fresh here, never from the cached hooks: a stale allowance approves the
// wrong amount.
export function useEndowFlow(label: string) {
  return useChainMutation<EndowArgs, boolean>('SpirithVault::endow()', async (tx, { amount }) => {
    if (amount <= 0n) throw new Error('Enter an amount.');
    const balance = await readContract(wagmiConfig, {
      ...USDC,
      functionName: 'balanceOf',
      args: [tx.account],
    });
    if (balance < amount) {
      await tx.send('MockUSDC::mint()', {
        ...USDC,
        functionName: 'mint',
        args: [tx.account, amount - balance],
      });
    }
    const allowance = await readContract(wagmiConfig, {
      ...USDC,
      functionName: 'allowance',
      args: [tx.account, VAULT.address],
    });
    if (allowance < amount) {
      await tx.send('MockUSDC::approve()', {
        ...USDC,
        functionName: 'approve',
        args: [VAULT.address, amount],
      });
    }
    const { receipt } = await tx.send('SpirithVault::endow()', {
      ...VAULT,
      functionName: 'endow',
      args: [label, amount],
    });
    return tx.indexing(receipt.blockNumber);
  });
}
