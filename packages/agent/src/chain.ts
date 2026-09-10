// The agent's view of the chain: one interface, one viem implementation, fakes in tests.
import { spirithContract } from '@spirith/core';
import { type Address, createPublicClient, http } from 'viem';
import type { AgentEnv } from './env.js';

export interface VaultRunway {
  readonly fundedUntilLow: bigint;
  readonly fundedUntilHigh: bigint;
  readonly assets: bigint;
  /** The block the vault would buy now; 0n when the earmark cannot afford one year. */
  readonly duration: bigint;
}

export interface VaultConstants {
  readonly depositCap: bigint;
  readonly reserveYears: number;
  readonly renewLead: bigint;
  readonly rateLowBps: number;
  readonly rateHighBps: number;
  readonly vault: Address;
  readonly usdc: Address;
}

export interface ChainReader {
  runwayOf(label: string): Promise<VaultRunway>;
  constants(): Promise<VaultConstants>;
}

export function viemChainReader(env: AgentEnv): ChainReader {
  const client = createPublicClient({ chain: env.chain.chain, transport: http(env.rpcUrl) });
  const vault = spirithContract(env.environment.name, 'spirithVault');
  const adapter = spirithContract(env.environment.name, 'mockYieldAdapter');
  let constants: Promise<VaultConstants> | undefined;
  return {
    async runwayOf(label) {
      const [fundedUntilLow, fundedUntilHigh, assets, duration] = await client.readContract({
        ...vault,
        functionName: 'runwayOf',
        args: [label],
      });
      return { fundedUntilLow, fundedUntilHigh, assets, duration };
    },
    constants() {
      constants ??= (async () => {
        const [depositCap, reserveYears, renewLead, usdc, [low, high]] = await Promise.all([
          client.readContract({ ...vault, functionName: 'DEPOSIT_CAP' }),
          client.readContract({ ...vault, functionName: 'RESERVE_YEARS' }),
          client.readContract({ ...vault, functionName: 'RENEW_LEAD' }),
          client.readContract({ ...vault, functionName: 'USDC' }),
          client.readContract({ ...adapter, functionName: 'rateRangeBps' }),
        ]);
        return {
          depositCap,
          reserveYears: Number(reserveYears),
          renewLead,
          rateLowBps: low,
          rateHighBps: high,
          vault: vault.address,
          usdc,
        };
      })();
      return constants;
    },
  };
}
