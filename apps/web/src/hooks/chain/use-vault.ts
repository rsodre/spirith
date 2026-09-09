'use client';

import { useMemo } from 'react';
import type { Address } from 'viem';
import { useReadContract, useReadContracts } from 'wagmi';
import { ADAPTER, VAULT } from './contracts';

export interface VaultRunway {
  readonly fundedUntilLow: bigint;
  readonly fundedUntilHigh: bigint;
  readonly assets: bigint;
  /** The block the vault would buy at the next renewal; 0n when not even a year is affordable. */
  readonly duration: bigint;
}

function toRunway(
  tuple: readonly [bigint, bigint, bigint, bigint] | undefined,
): VaultRunway | undefined {
  if (!tuple) return undefined;
  return {
    fundedUntilLow: tuple[0],
    fundedUntilHigh: tuple[1],
    assets: tuple[2],
    duration: tuple[3],
  };
}

/** `runwayOf(label)`: the live earmark and its funded-until range. */
export function useVaultRunway(label: string) {
  const q = useReadContract({
    ...VAULT,
    functionName: 'runwayOf',
    args: [label],
    query: { enabled: label.length > 0 },
  });
  const runway = useMemo(() => toRunway(q.data), [q.data]);
  return { runway, isLoading: q.isLoading, error: q.error };
}

/** `runwayOf` for many names in one multicall; keyed by label. */
export function useVaultRunways(labels: readonly string[]) {
  const contracts = useMemo(
    () => labels.map(label => ({ ...VAULT, functionName: 'runwayOf' as const, args: [label] })),
    [labels],
  );
  const q = useReadContracts({
    contracts,
    allowFailure: true,
    query: { enabled: labels.length > 0 },
  });
  const runways = useMemo(() => {
    const map = new Map<string, VaultRunway>();
    q.data?.forEach((r, i) => {
      const label = labels[i];
      const runway = r.status === 'success' ? toRunway(r.result) : undefined;
      if (label !== undefined && runway) map.set(label, runway);
    });
    return map;
  }, [q.data, labels]);
  return { runways, isLoading: q.isLoading };
}

export interface VaultConstants {
  readonly depositCap: bigint;
  readonly reserveYears: bigint;
  readonly renewLead: bigint;
  readonly noticePeriod: bigint;
  readonly tipBps: bigint;
  readonly tipCap: bigint;
  readonly rateLowBps: number;
  readonly rateHighBps: number;
}

const CONSTANT_READS = [
  { ...VAULT, functionName: 'DEPOSIT_CAP' },
  { ...VAULT, functionName: 'RESERVE_YEARS' },
  { ...VAULT, functionName: 'RENEW_LEAD' },
  { ...VAULT, functionName: 'NOTICE_PERIOD' },
  { ...VAULT, functionName: 'TIP_BPS' },
  { ...VAULT, functionName: 'TIP_CAP' },
  { ...ADAPTER, functionName: 'rateRangeBps' },
] as const;

/** Immutables and the adapter's rate range; fetched once. */
export function useVaultConstants() {
  const q = useReadContracts({
    contracts: CONSTANT_READS,
    allowFailure: false,
    query: { staleTime: Number.POSITIVE_INFINITY },
  });
  const constants = useMemo<VaultConstants | undefined>(() => {
    if (!q.data) return undefined;
    const [depositCap, reserveYears, renewLead, noticePeriod, tipBps, tipCap, [low, high]] = q.data;
    return {
      depositCap,
      reserveYears,
      renewLead,
      noticePeriod,
      tipBps,
      tipCap,
      rateLowBps: low,
      rateHighBps: high,
    };
  }, [q.data]);
  return { constants, isLoading: q.isLoading, error: q.error };
}

/** Keeper tip for a price, mirroring `tipFor`: `min(price × bps / 10000, cap)`. */
export function tipFor(price: bigint, constants: VaultConstants): bigint {
  const tip = (price * constants.tipBps) / 10_000n;
  return tip < constants.tipCap ? tip : constants.tipCap;
}

export interface PatronPosition {
  readonly shares: bigint;
  readonly noticeShares: bigint;
  readonly noticeAt: bigint;
  /** USDC value of the whole claim at the current share price. */
  readonly assets: bigint;
}

/** One patron's claim on one name: internal shares, any pending notice, and its USDC value. */
export function usePatronPosition(label: string, patron: Address | undefined) {
  const labelhash = useReadContract({
    ...VAULT,
    functionName: 'labelhash',
    args: [label],
    query: { enabled: label.length > 0, staleTime: Number.POSITIVE_INFINITY },
  });
  const contracts = useMemo(
    () =>
      patron && labelhash.data
        ? ([
            { ...VAULT, functionName: 'positions', args: [labelhash.data, patron] },
            { ...VAULT, functionName: 'patronAssets', args: [label, patron] },
          ] as const)
        : undefined,
    [label, patron, labelhash.data],
  );
  const q = useReadContracts({
    contracts,
    allowFailure: false,
    query: { enabled: contracts !== undefined },
  });
  const position = useMemo<PatronPosition | undefined>(() => {
    if (!q.data) return undefined;
    const [[shares, noticeShares, noticeAt], assets] = q.data;
    return { shares, noticeShares, noticeAt, assets };
  }, [q.data]);
  return { position, isLoading: q.isLoading || labelhash.isLoading };
}

/** `patronAssets(label, patron)` for many names in one multicall; keyed by label. */
export function usePatronAssetsMany(labels: readonly string[], patron: Address | undefined) {
  const contracts = useMemo(
    () =>
      patron
        ? labels.map(label => ({
            ...VAULT,
            functionName: 'patronAssets' as const,
            args: [label, patron] as const,
          }))
        : [],
    [labels, patron],
  );
  const q = useReadContracts({
    contracts,
    allowFailure: true,
    query: { enabled: contracts.length > 0 },
  });
  const assets = useMemo(() => {
    const map = new Map<string, bigint>();
    q.data?.forEach((r, i) => {
      const label = labels[i];
      if (label !== undefined && r.status === 'success') map.set(label, r.result);
    });
    return map;
  }, [q.data, labels]);
  return { assets, isLoading: contracts.length > 0 && q.isLoading };
}
