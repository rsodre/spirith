import { getAddress, type Address } from 'viem';
import type { ChainName } from '../chains.js';
import type { ContractRef } from '../ens/registry.js';
import { SpirithVaultAbi } from '../generated/spirith/SpirithVault.js';
import { MockYieldAdapterAbi } from '../generated/spirith/MockYieldAdapter.js';
import sepolia from '../../deployments/sepolia.json' with { type: 'json' };

// Deployed addresses come from the Foundry deploy script's JSON, never from a hand-typed literal.
export interface SpirithDeployment {
  readonly chainId: number;
  readonly block: number;
  readonly spirithVault: Address;
  readonly mockYieldAdapter: Address;
  readonly usdc: Address;
  readonly owner: Address;
}

function asDeployment(raw: typeof sepolia): SpirithDeployment {
  return {
    chainId: raw.chainId,
    block: raw.block,
    spirithVault: getAddress(raw.spirithVault),
    mockYieldAdapter: getAddress(raw.mockYieldAdapter),
    usdc: getAddress(raw.usdc),
    owner: getAddress(raw.owner),
  };
}

export const SPIRITH_DEPLOYMENTS: Readonly<Record<ChainName, SpirithDeployment>> = {
  sepolia: asDeployment(sepolia),
};

export const SPIRITH_CONTRACTS = {
  spirithVault: SpirithVaultAbi,
  mockYieldAdapter: MockYieldAdapterAbi,
} as const;

export type SpirithContractName = keyof typeof SPIRITH_CONTRACTS;

export function spirithContract<TName extends SpirithContractName>(
  chain: ChainName,
  name: TName,
): ContractRef<(typeof SPIRITH_CONTRACTS)[TName]> {
  return { address: SPIRITH_DEPLOYMENTS[chain][name], abi: SPIRITH_CONTRACTS[name] };
}

/** The two text records the vault writes on a name's PermissionedResolver (spec §4.3). */
export const SPIRITH_RECORDS = {
  fundedUntil: 'spirith.funded-until',
  patrons: 'spirith.patrons',
} as const;
