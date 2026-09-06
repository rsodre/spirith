import { getAddress, type Abi, type Address } from 'viem';
import type { ChainName } from '../chains.js';
import { ENS_DEPLOYMENTS } from './addresses.js';
import { ETHRegistrarAbi } from '../generated/ens/ETHRegistrar.js';
import { ETHRegistryAbi } from '../generated/ens/ETHRegistry.js';
import { StandardRentPriceOracleAbi } from '../generated/ens/StandardRentPriceOracle.js';
import { MockUSDCAbi } from '../generated/ens/MockUSDC.js';
import { PermissionedResolverImplAbi } from '../generated/ens/PermissionedResolverImpl.js';
import { VerifiableFactoryAbi } from '../generated/ens/VerifiableFactory.js';

// The one registry: address and ABI travel together, resolved by the same lookup.
// Adding a contract is an edit here and nowhere else.
export const ENS_CONTRACTS = {
  ethRegistrar: ETHRegistrarAbi,
  ethRegistry: ETHRegistryAbi,
  rentPriceOracle: StandardRentPriceOracleAbi,
  mockUsdc: MockUSDCAbi,
  permissionedResolverImpl: PermissionedResolverImplAbi,
  verifiableFactory: VerifiableFactoryAbi,
} as const;

export type EnsContractName = keyof typeof ENS_CONTRACTS;

export interface ContractRef<TAbi extends Abi = Abi> {
  readonly address: Address;
  readonly abi: TAbi;
}

export function ensContract<TName extends EnsContractName>(
  chain: ChainName,
  name: TName,
): ContractRef<(typeof ENS_CONTRACTS)[TName]> {
  return {
    address: getAddress(ENS_DEPLOYMENTS[chain][name]),
    abi: ENS_CONTRACTS[name],
  };
}
