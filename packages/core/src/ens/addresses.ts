import { getAddress, type Address } from 'viem';
import type { EnvName } from '../environment.js';
import hackathon from '../../deployments/ens/hackathon.json' with { type: 'json' };
import sepolia from '../../deployments/ens/sepolia.json' with { type: 'json' };

// One ENSv2 contract set per environment, from the JSON files under deployments/ens/ (spec §2).
// Those files are the single source: the subgraph's prepare script and the Foundry scripts read
// the same JSON, so an address changes in one place or nowhere. Both Sepolia sets were verified
// live through their own Universal Resolver entry point; every other Sepolia set in the
// namechain repo is stale. ENSv2 has no mainnet deployment yet, so `mainnet` has no entry.
export interface EnsDeployment {
  readonly chainId: number;
  /** Creation blocks of the two contracts the subgraph indexes. */
  readonly startBlock: { readonly ethRegistry: number; readonly ethRegistrar: number };
  readonly ethRegistrar: Address;
  readonly ethRegistry: Address;
  readonly rootRegistry: Address;
  readonly rentPriceOracle: Address;
  readonly mockUsdc: Address;
  readonly mockDai: Address;
  readonly circleUsdc: Address;
  readonly permissionedResolverImpl: Address;
  readonly verifiableFactory: Address;
  readonly universalResolver: Address;
  readonly publicResolverV2: Address;
  readonly paymentBeneficiary: Address;
}

type RawEnsDeployment = typeof sepolia;

function asDeployment(raw: RawEnsDeployment): EnsDeployment {
  return {
    chainId: raw.chainId,
    startBlock: { ...raw.startBlock },
    ethRegistrar: getAddress(raw.ethRegistrar),
    ethRegistry: getAddress(raw.ethRegistry),
    rootRegistry: getAddress(raw.rootRegistry),
    rentPriceOracle: getAddress(raw.rentPriceOracle),
    mockUsdc: getAddress(raw.mockUsdc),
    mockDai: getAddress(raw.mockDai),
    circleUsdc: getAddress(raw.circleUsdc),
    permissionedResolverImpl: getAddress(raw.permissionedResolverImpl),
    verifiableFactory: getAddress(raw.verifiableFactory),
    universalResolver: getAddress(raw.universalResolver),
    publicResolverV2: getAddress(raw.publicResolverV2),
    paymentBeneficiary: getAddress(raw.paymentBeneficiary),
  };
}

export const ENS_DEPLOYMENTS: Readonly<Partial<Record<EnvName, EnsDeployment>>> = {
  hackathon: asDeployment(hackathon),
  sepolia: asDeployment(sepolia),
};

/** The ENSv2 set of an environment; throws where ENSv2 is not deployed (mainnet, for now). */
export function ensDeployment(env: EnvName): EnsDeployment {
  const deployment = ENS_DEPLOYMENTS[env];
  if (!deployment) throw new Error(`ENSv2 is not deployed on the ${env} environment`);
  return deployment;
}
