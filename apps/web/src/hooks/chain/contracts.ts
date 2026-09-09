import { type ContractRef, ENS_CONTRACTS, ensContract, spirithContract } from '@spirith/core';
import type { Address } from 'viem';
import { APP_CHAIN } from '@/lib/chain';

// Resolved once at module scope so every hook hands wagmi the same `{ address, abi }` object;
// chain hooks memoise their contract on that reference. Adding a contract is an edit here.
export const VAULT = spirithContract(APP_CHAIN.name, 'spirithVault');
export const ADAPTER = spirithContract(APP_CHAIN.name, 'mockYieldAdapter');
export const USDC = ensContract(APP_CHAIN.name, 'mockUsdc');
export const REGISTRY = ensContract(APP_CHAIN.name, 'ethRegistry');
export const REGISTRAR = ensContract(APP_CHAIN.name, 'ethRegistrar');
export const FACTORY = ensContract(APP_CHAIN.name, 'verifiableFactory');
export const RESOLVER_IMPL = ensContract(APP_CHAIN.name, 'permissionedResolverImpl');

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

export const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000';
