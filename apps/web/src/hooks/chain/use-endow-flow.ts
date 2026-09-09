'use client';

import { readContract } from 'wagmi/actions';
import { wagmiConfig } from '@/lib/wagmi';
import { USDC, VAULT } from './contracts';
import { useChainMutation } from './use-chain-mutation';

export interface EndowArgs {
  readonly amount: bigint;
}

/** What a short wallet is minted on Sepolia: one capped endowment's worth. */
export const TOPUP_USDC = 100_000_000n;

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
      const shortfall = amount - balance;
      await tx.send('MockUSDC::mint()', {
        ...USDC,
        functionName: 'mint',
        args: [tx.account, shortfall > TOPUP_USDC ? shortfall : TOPUP_USDC],
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
