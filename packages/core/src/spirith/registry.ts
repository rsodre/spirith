import { getAddress, type Address } from 'viem';
import type { EnvName } from '../environment.js';
import type { ContractRef } from '../ens/registry.js';
import { SpirithVaultAbi } from '../generated/spirith/SpirithVault.js';
import { MockYieldAdapterAbi } from '../generated/spirith/MockYieldAdapter.js';
import hackathon from '../../deployments/hackathon.json' with { type: 'json' };
import sepolia from '../../deployments/sepolia.json' with { type: 'json' };

// Deployed addresses come from the Foundry deploy script's JSON, one file per environment under
// deployments/, never from a hand-typed literal. Deploying to a new environment adds one import
// and one entry below; `Deploy.s.sol` prints the reminder.
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

export const SPIRITH_DEPLOYMENTS: Readonly<Partial<Record<EnvName, SpirithDeployment>>> = {
  hackathon: asDeployment(hackathon),
  sepolia: asDeployment(sepolia),
};

/** Spirith's own contracts on an environment; throws until `Deploy.s.sol` has run there. */
export function spirithDeployment(env: EnvName): SpirithDeployment {
  const deployment = SPIRITH_DEPLOYMENTS[env];
  if (!deployment) {
    throw new Error(
      `Spirith is not deployed on the ${env} environment; run contracts/script/Deploy.s.sol with SPIRITH_ENV=${env}`,
    );
  }
  return deployment;
}

export const SPIRITH_CONTRACTS = {
  spirithVault: SpirithVaultAbi,
  mockYieldAdapter: MockYieldAdapterAbi,
} as const;

export type SpirithContractName = keyof typeof SPIRITH_CONTRACTS;

export function spirithContract<TName extends SpirithContractName>(
  env: EnvName,
  name: TName,
): ContractRef<(typeof SPIRITH_CONTRACTS)[TName]> {
  return { address: spirithDeployment(env)[name], abi: SPIRITH_CONTRACTS[name] };
}

/** The two text records the vault writes on a name's PermissionedResolver (spec §4.3). */
export const SPIRITH_RECORDS = {
  fundedUntil: 'spirith.funded-until',
  patrons: 'spirith.patrons',
} as const;
