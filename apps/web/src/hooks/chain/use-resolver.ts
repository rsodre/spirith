'use client';

import { useMemo } from 'react';
import { type Address, type Hex, decodeAbiParameters, encodeFunctionData } from 'viem';
import { useReadContracts } from 'wagmi';
import { SPIRITH_RECORDS } from '@spirith/core';
import { dnsEncodeEth, nameNode } from '@/lib/dns';
import {
  UNIVERSAL_RESOLVER,
  VAULT,
  ZERO_ADDRESS,
  resolverContract,
  resolverV2Contract,
} from './contracts';

// Records are read the way every ENS client reads them, ENSIP-10 through the environment's
// Universal Resolver: `resolve(name, text(node, key))`. That serves both PermissionedResolver
// generations (the record-linked one answers only `resolve`) and the shared PublicResolverV2.

/** `resolve(name, text(node, key))` on the Universal Resolver, for `useReadContracts`. */
function textRead(label: string, key: string) {
  return {
    ...UNIVERSAL_RESOLVER,
    functionName: 'resolve',
    args: [
      dnsEncodeEth(label),
      encodeFunctionData({
        abi: resolverContract(ZERO_ADDRESS).abi,
        functionName: 'text',
        args: [nameNode(label), key],
      }),
    ],
  } as const;
}

/** The string inside a `resolve` answer; null when the resolver could not answer. */
function decodeText(result: { status: string; result?: unknown }): string | null {
  if (result.status !== 'success') return null;
  const [data] = result.result as readonly [Hex, Address];
  try {
    return decodeAbiParameters([{ type: 'string' }], data)[0];
  } catch {
    return null;
  }
}

export interface SpirithRecords {
  /** Unix seconds as written by the vault, or null when unset or unreadable. */
  readonly fundedUntil: bigint | null;
  readonly patrons: number | null;
  /** The resolver answered a text read at all; false for a resolver without records. */
  readonly supported: boolean;
}

/** The two `spirith.*` text records on a name's resolver, straight from the chain. */
export function useSpirithRecords(label: string, resolver: Address | undefined) {
  const enabled = label.length > 0 && resolver !== undefined && resolver !== ZERO_ADDRESS;
  const contracts = useMemo(() => {
    if (!enabled) return undefined;
    return [
      textRead(label, SPIRITH_RECORDS.fundedUntil),
      textRead(label, SPIRITH_RECORDS.patrons),
    ] as const;
  }, [enabled, label]);
  const q = useReadContracts({ contracts, allowFailure: true, query: { enabled } });
  const records = useMemo<SpirithRecords | undefined>(() => {
    if (!q.data) return undefined;
    const [funded, patrons] = q.data;
    const fundedText = decodeText(funded);
    const patronsText = decodeText(patrons);
    return {
      fundedUntil: fundedText !== null && /^\d+$/.test(fundedText) ? BigInt(fundedText) : null,
      patrons: patronsText !== null && /^\d+$/.test(patronsText) ? Number(patronsText) : null,
      supported: fundedText !== null && patronsText !== null,
    };
  }, [q.data]);
  return { records, isLoading: enabled && q.isLoading };
}

export interface RecordTarget {
  readonly label: string;
  readonly resolver: Address | null;
}

/** `spirith.funded-until` for many names in one multicall; a name whose resolver has no
 * record, or no resolver, maps to null. Keyed by label. */
export function useSpirithFundedUntilMany(targets: readonly RecordTarget[]) {
  const readable = useMemo(
    () => targets.filter(t => t.resolver !== null && t.resolver !== ZERO_ADDRESS),
    [targets],
  );
  const contracts = useMemo(
    () => readable.map(t => textRead(t.label, SPIRITH_RECORDS.fundedUntil)),
    [readable],
  );
  const q = useReadContracts({
    contracts,
    allowFailure: true,
    query: { enabled: contracts.length > 0 },
  });
  const fundedUntil = useMemo(() => {
    const map = new Map<string, bigint | null>();
    for (const t of targets) map.set(t.label, null);
    q.data?.forEach((r, i) => {
      const t = readable[i];
      const text = decodeText(r);
      if (t && text !== null && /^\d+$/.test(text)) map.set(t.label, BigInt(text));
    });
    return map;
  }, [q.data, readable, targets]);
  return { fundedUntil, isLoading: contracts.length > 0 && q.isLoading };
}

const RECORD_KEYS = [SPIRITH_RECORDS.fundedUntil, SPIRITH_RECORDS.patrons] as const;

/** Whether the vault holds the setter role for both `spirith.*` keys on a record-linked
 * PermissionedResolver, read the way the grant was made: `decodeSetter` names the resource and
 * role behind `setText(name, key, ...)`, `hasRoles` says whether the vault has them. Null for
 * the shared public resolver or the older generation, which answer neither. The grant alone
 * writes nothing; the vault publishes the records at its next endow, withdraw or renew. */
export function useVaultAuthorised(label: string, resolver: Address | undefined) {
  const enabled = label.length > 0 && resolver !== undefined && resolver !== ZERO_ADDRESS;
  const setters = useMemo(() => {
    if (!enabled) return undefined;
    const ref = resolverV2Contract(resolver);
    const name = dnsEncodeEth(label);
    return RECORD_KEYS.map(
      key =>
        ({
          ...ref,
          functionName: 'decodeSetter',
          args: [
            encodeFunctionData({ abi: ref.abi, functionName: 'setText', args: [name, key, ''] }),
          ],
        }) as const,
    );
  }, [enabled, label, resolver]);
  const decoded = useReadContracts({ contracts: setters, allowFailure: true, query: { enabled } });
  const checks = useMemo(() => {
    if (!enabled || !decoded.data) return undefined;
    const ref = resolverV2Contract(resolver);
    const out = [];
    for (const r of decoded.data) {
      if (r.status !== 'success') return undefined;
      const [, resource, roleBitmap] = r.result;
      out.push({
        ...ref,
        functionName: 'hasRoles',
        args: [resource, roleBitmap, VAULT.address],
      } as const);
    }
    return out;
  }, [enabled, decoded.data, resolver]);
  const has = useReadContracts({
    contracts: checks,
    allowFailure: true,
    query: { enabled: checks !== undefined },
  });
  const authorised = useMemo<boolean | null>(() => {
    if (!checks || !has.data) return null;
    return has.data.every(r => r.status === 'success' && r.result === true);
  }, [checks, has.data]);
  return { authorised, isLoading: enabled && (decoded.isLoading || has.isLoading) };
}
