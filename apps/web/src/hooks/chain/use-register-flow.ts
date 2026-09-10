'use client';

import { type Hex, pad, toHex } from 'viem';
import { readContract } from 'wagmi/actions';
import { wagmiConfig } from '@/lib/wagmi';
import { ENS, REGISTRAR, USDC, VAULT, ZERO_ADDRESS } from './contracts';
import { useChainMutation } from './use-chain-mutation';
import { TOPUP_USDC } from './use-endow-flow';

export interface RegisterArgs {
  readonly label: string;
  readonly duration: bigint;
}

/** Spirith's own address, left-padded: the referrer on every registration and renewal. */
const REFERRER: Hex = pad(VAULT.address, { size: 32 });

function randomSecret(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

// ENSv2 registration from the browser, mirroring contracts/script/RegisterName.s.sol: commit,
// hold for the registrar's minimum commitment age, then mint if short, approve and register,
// on the shared PublicResolverV2. One mutation, one toast; a reload mid-way means starting
// again with a new secret, which only costs the commit's gas.
export function useRegisterFlow() {
  return useChainMutation<RegisterArgs, boolean>(
    'ETHRegistrar::register()',
    async (tx, { label, duration }) => {
      const resolver = ENS.publicResolverV2;
      const secret = randomSecret();
      const [available, minAge] = await Promise.all([
        readContract(wagmiConfig, { ...REGISTRAR, functionName: 'isAvailable', args: [label] }),
        readContract(wagmiConfig, { ...REGISTRAR, functionName: 'MIN_COMMITMENT_AGE' }),
      ]);
      if (!available) throw new Error(`${label}.eth is not available.`);
      const commitment = await readContract(wagmiConfig, {
        ...REGISTRAR,
        functionName: 'makeCommitment',
        args: [label, tx.account, secret, ZERO_ADDRESS, resolver, duration, REFERRER],
      });
      await tx.send('ETHRegistrar::commit()', {
        ...REGISTRAR,
        functionName: 'commit',
        args: [commitment],
      });
      await tx.pause('commitment ageing', Number(minAge) + 5);

      const [base, premium] = await readContract(wagmiConfig, {
        ...REGISTRAR,
        functionName: 'getRegisterPrice',
        args: [label, duration, USDC.address],
      });
      const price = base + premium;
      const balance = await readContract(wagmiConfig, {
        ...USDC,
        functionName: 'balanceOf',
        args: [tx.account],
      });
      if (balance < price) {
        const shortfall = price - balance;
        await tx.send('MockUSDC::mint()', {
          ...USDC,
          functionName: 'mint',
          args: [tx.account, shortfall > TOPUP_USDC ? shortfall : TOPUP_USDC],
        });
      }
      await tx.send('MockUSDC::approve()', {
        ...USDC,
        functionName: 'approve',
        args: [REGISTRAR.address, price],
      });
      const { receipt } = await tx.send('ETHRegistrar::register()', {
        ...REGISTRAR,
        functionName: 'register',
        args: [label, tx.account, secret, ZERO_ADDRESS, resolver, duration, USDC.address, REFERRER],
      });
      return tx.indexing(receipt.blockNumber);
    },
  );
}
