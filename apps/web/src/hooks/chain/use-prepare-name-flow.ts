'use client';

import { RESOLVER_GENERATION_ID, SPIRITH_RECORDS } from '@spirith/core';
import {
  type Address,
  encodeFunctionData,
  encodePacked,
  getAbiItem,
  isAddressEqual,
  keccak256,
} from 'viem';
import { getBlockNumber, getPublicClient, readContract } from 'wagmi/actions';
import { dnsEncodeEth } from '@/lib/dns';
import { wagmiConfig } from '@/lib/wagmi';
import {
  ENS,
  FACTORY,
  REGISTRY,
  RESOLVER_IMPL,
  VAULT,
  ZERO_ADDRESS,
  resolverContract,
  resolverV2Contract,
} from './contracts';
import { useChainMutation } from './use-chain-mutation';

// PermissionedResolverLib of each generation: every regular role and its admin counterpart,
// as contracts/script/ResolverSetup.s.sol (the older generation also had nybbles 8 and 9).
const bits = (nybbles: readonly bigint[]) => nybbles.reduce((acc, bit) => acc | (1n << bit), 0n);
const LEGACY_ROLES = bits([0n, 4n, 8n, 12n, 16n, 20n, 24n, 28n, 32n, 36n, 120n, 124n]);
const LINKED_ROLES = bits([0n, 4n, 8n, 12n, 16n, 20n, 24n, 28n, 120n, 124n]);
const withAdmin = (roles: bigint) => roles | (roles << 128n);

/** Whether the environment's PermissionedResolver is the record-linked generation (DNS-name
 * setters, `grantSetterRoles`) rather than the older node-keyed one, read from the
 * implementation itself with ERC-165. */
async function isRecordLinked(): Promise<boolean> {
  return readContract(wagmiConfig, {
    ...resolverV2Contract(RESOLVER_IMPL.address),
    functionName: 'supportsInterface',
    args: [RESOLVER_GENERATION_ID],
  });
}

// The public RPC refuses log queries wider than this many blocks.
const LOG_RANGE = 50_000n;
const PROXY_DEPLOYED = getAbiItem({ abi: FACTORY.abi, name: 'ProxyDeployed' });

/** The proxy `account` already deployed through the factory with `salt`, if any. The factory
 * has no address-prediction view and CREATE2 refuses a second deploy for the same salt, so a
 * flow that stopped after its first transaction resumes from here instead of reverting. */
async function findDeployedProxy(account: Address, salt: bigint): Promise<Address | undefined> {
  const client = getPublicClient(wagmiConfig);
  if (!client) return undefined;
  const head = await getBlockNumber(wagmiConfig);
  for (let from = BigInt(ENS.startBlock.ethRegistry); from <= head; from += LOG_RANGE) {
    const toBlock = from + LOG_RANGE - 1n < head ? from + LOG_RANGE - 1n : head;
    const logs = await client.getLogs({
      address: FACTORY.address,
      event: PROXY_DEPLOYED,
      args: { sender: account },
      fromBlock: from,
      toBlock,
    });
    const hit = logs.find(log => log.args.salt === salt);
    if (hit?.args.proxyAddress) return hit.args.proxyAddress;
  }
  return undefined;
}

/** The one optional owner action (spec §4.3): give the name its own PermissionedResolver
 * when it sits on the shared PublicResolverV2, point the registry at it, then let the vault
 * write the two `spirith.*` records. Renewals never depend on any of this. */
export function usePrepareNameFlow(label: string) {
  return useChainMutation<void, Address>('let Spirith publish the record', async tx => {
    const shared = ENS.publicResolverV2;
    const linked = await isRecordLinked();
    let resolver = await readContract(wagmiConfig, {
      ...REGISTRY,
      functionName: 'getResolver',
      args: [label],
    });
    if (isAddressEqual(resolver, ZERO_ADDRESS) || isAddressEqual(resolver, shared)) {
      const salt = BigInt(
        keccak256(encodePacked(['string', 'string', 'address'], ['spirith', label, tx.account])),
      );
      const init = linked
        ? encodeFunctionData({
            abi: resolverV2Contract(RESOLVER_IMPL.address).abi,
            functionName: 'initialize',
            args: [[{ account: tx.account, roleBitmap: withAdmin(LINKED_ROLES) }], []],
          })
        : encodeFunctionData({
            abi: RESOLVER_IMPL.abi,
            functionName: 'initialize',
            args: [tx.account, withAdmin(LEGACY_ROLES), []],
          });
      const existing = await findDeployedProxy(tx.account, salt);
      if (existing) {
        resolver = existing;
      } else {
        const deployed = await tx.send('VerifiableFactory::deployProxy()', {
          ...FACTORY,
          functionName: 'deployProxy',
          args: [RESOLVER_IMPL.address, salt, init],
        });
        resolver = deployed.result as Address;
      }
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
    const name = dnsEncodeEth(label);
    const keys = [SPIRITH_RECORDS.fundedUntil, SPIRITH_RECORDS.patrons] as const;
    let last: { receipt: { blockNumber: bigint } } | undefined;
    for (const key of keys) {
      last = linked
        ? await tx.send(`PermissionedResolver::grantSetterRoles(${key})`, {
            ...resolverV2Contract(resolver),
            functionName: 'grantSetterRoles',
            args: [
              encodeFunctionData({
                abi: resolverV2Contract(resolver).abi,
                functionName: 'setText',
                args: [name, key, ''],
              }),
              VAULT.address,
            ],
          })
        : await tx.send(`PermissionedResolver::authorizeTextRoles(${key})`, {
            ...resolverContract(resolver),
            functionName: 'authorizeTextRoles',
            args: [name, key, VAULT.address, true],
          });
    }
    if (last) await tx.indexing(last.receipt.blockNumber);
    return resolver;
  });
}
