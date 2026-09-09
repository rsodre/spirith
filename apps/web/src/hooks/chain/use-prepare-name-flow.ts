'use client';

import { ENS_DEPLOYMENTS, SPIRITH_RECORDS } from '@spirith/core';
import { type Address, encodeFunctionData, encodePacked, isAddressEqual, keccak256 } from 'viem';
import { readContract } from 'wagmi/actions';
import { APP_CHAIN } from '@/lib/chain';
import { dnsEncodeEth } from '@/lib/dns';
import { wagmiConfig } from '@/lib/wagmi';
import {
  FACTORY,
  REGISTRY,
  RESOLVER_IMPL,
  VAULT,
  ZERO_ADDRESS,
  resolverContract,
} from './contracts';
import { useChainMutation } from './use-chain-mutation';

// PermissionedResolverLib: every regular role and its admin counterpart, as PrepareName.s.sol.
const REGULAR_ROLES = [0n, 4n, 8n, 12n, 16n, 20n, 24n, 28n, 32n, 36n, 120n, 124n].reduce(
  (acc, bit) => acc | (1n << bit),
  0n,
);
const ALL_ROLES = REGULAR_ROLES | (REGULAR_ROLES << 128n);

/** The one optional owner action (spec §4.3): give the name its own PermissionedResolver
 * when it sits on the shared PublicResolverV2, point the registry at it, then let the vault
 * write the two `spirith.*` records. Renewals never depend on any of this. */
export function usePrepareNameFlow(label: string) {
  return useChainMutation<void, Address>('let Spirith publish the record', async tx => {
    const shared = ENS_DEPLOYMENTS[APP_CHAIN.name].publicResolverV2;
    let resolver = await readContract(wagmiConfig, {
      ...REGISTRY,
      functionName: 'getResolver',
      args: [label],
    });
    if (isAddressEqual(resolver, ZERO_ADDRESS) || isAddressEqual(resolver, shared)) {
      const salt = BigInt(
        keccak256(encodePacked(['string', 'string', 'address'], ['spirith', label, tx.account])),
      );
      const init = encodeFunctionData({
        abi: RESOLVER_IMPL.abi,
        functionName: 'initialize',
        args: [tx.account, ALL_ROLES, []],
      });
      const deployed = await tx.send('VerifiableFactory::deployProxy()', {
        ...FACTORY,
        functionName: 'deployProxy',
        args: [RESOLVER_IMPL.address, salt, init],
      });
      resolver = deployed.result as Address;
      const tokenId = await readContract(wagmiConfig, {
        ...REGISTRY,
        functionName: 'findTokenId',
        args: [label],
      });
      await tx.send('ETHRegistry::setResolver()', {
        ...REGISTRY,
        functionName: 'setResolver',
        args: [tokenId, resolver],
      });
    }
    const ref = resolverContract(resolver);
    const name = dnsEncodeEth(label);
    await tx.send('PermissionedResolver::authorizeTextRoles(funded-until)', {
      ...ref,
      functionName: 'authorizeTextRoles',
      args: [name, SPIRITH_RECORDS.fundedUntil, VAULT.address, true],
    });
    const { receipt } = await tx.send('PermissionedResolver::authorizeTextRoles(patrons)', {
      ...ref,
      functionName: 'authorizeTextRoles',
      args: [name, SPIRITH_RECORDS.patrons, VAULT.address, true],
    });
    await tx.indexing(receipt.blockNumber);
    return resolver;
  });
}
