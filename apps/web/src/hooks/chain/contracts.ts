import {
  type ContractRef,
  ENS_CONTRACTS,
  PERMISSIONED_RESOLVER_V2_ABI,
  ensContract,
  ensDeployment,
  spirithContract,
  spirithDeployment,
} from '@spirith/core';
import type { Address } from 'viem';
import { APP_ENV } from '@/lib/chain';

// Resolved once at module scope so every hook hands wagmi the same `{ address, abi }` object;
// chain hooks memoise their contract on that reference. Adding a contract is an edit here.
// Both lookups throw at boot when the environment has no such deployment, on purpose.
export const ENS = ensDeployment(APP_ENV.name);
export const SPIRITH = spirithDeployment(APP_ENV.name);
export const VAULT = spirithContract(APP_ENV.name, 'spirithVault');
export const ADAPTER = spirithContract(APP_ENV.name, 'mockYieldAdapter');
export const USDC = ensContract(APP_ENV.name, 'mockUsdc');
export const REGISTRY = ensContract(APP_ENV.name, 'ethRegistry');
export const REGISTRAR = ensContract(APP_ENV.name, 'ethRegistrar');
export const FACTORY = ensContract(APP_ENV.name, 'verifiableFactory');
export const RESOLVER_IMPL = ensContract(APP_ENV.name, 'permissionedResolverImpl');
/** ENSIP-10 entry point of the environment's ENSv2 set; every record read goes through it. */
export const UNIVERSAL_RESOLVER = ensContract(APP_ENV.name, 'universalResolver');

export type ResolverRef = ContractRef<typeof ENS_CONTRACTS.permissionedResolverImpl>;
const resolvers = new Map<Address, ResolverRef>();

/** A name's own resolver, at whatever address the registry reports; cached for identity. */
export function resolverContract(address: Address): ResolverRef {
  let ref = resolvers.get(address);
  if (!ref) {
    ref = { address, abi: ENS_CONTRACTS.permissionedResolverImpl };
    resolvers.set(address, ref);
  }
  return ref;
}

export type ResolverV2Ref = ContractRef<typeof PERMISSIONED_RESOLVER_V2_ABI>;
const resolversV2 = new Map<Address, ResolverV2Ref>();

/** The same resolver seen as the record-linked generation (DNS-name setters). */
export function resolverV2Contract(address: Address): ResolverV2Ref {
  let ref = resolversV2.get(address);
  if (!ref) {
    ref = { address, abi: PERMISSIONED_RESOLVER_V2_ABI };
    resolversV2.set(address, ref);
  }
  return ref;
}

export const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000';
