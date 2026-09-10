import type { Abi, Address } from 'viem';
import type { EnvName } from '../environment.js';
import { ensDeployment } from './addresses.js';
import { ETHRegistrarAbi } from '../generated/ens/ETHRegistrar.js';
import { ETHRegistryAbi } from '../generated/ens/ETHRegistry.js';
import { StandardRentPriceOracleAbi } from '../generated/ens/StandardRentPriceOracle.js';
import { MockUSDCAbi } from '../generated/ens/MockUSDC.js';
import { PermissionedResolverImplAbi } from '../generated/ens/PermissionedResolverImpl.js';
import { PermissionedResolverImplV2Abi } from '../generated/ens/PermissionedResolverImplV2.js';
import { UniversalResolverAbi } from '../generated/ens/UniversalResolver.js';
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
  universalResolver: UniversalResolverAbi,
} as const;

/** The record-linked PermissionedResolver generation (the hackathon set's): DNS-name setters,
 * `grantSetterRoles`, ENSIP-10 reads. It shares the `permissionedResolverImpl` address slot;
 * which generation an environment runs is read from the implementation with ERC-165
 * (`RESOLVER_GENERATION_ID`), never configured. */
export const PERMISSIONED_RESOLVER_V2_ABI = PermissionedResolverImplV2Abi;
/** ERC-165 id of IPermissionedResolverInitializable, true only on the record-linked generation. */
export const RESOLVER_GENERATION_ID = '0x33cc44a0' as const;

export type EnsContractName = keyof typeof ENS_CONTRACTS;

export interface ContractRef<TAbi extends Abi = Abi> {
  readonly address: Address;
  readonly abi: TAbi;
}

export function ensContract<TName extends EnsContractName>(
  env: EnvName,
  name: TName,
): ContractRef<(typeof ENS_CONTRACTS)[TName]> {
  return { address: ensDeployment(env)[name], abi: ENS_CONTRACTS[name] };
}
