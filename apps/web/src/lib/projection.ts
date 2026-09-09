// What a deposit buys, computed the way the vault will: its cadence heuristic (the longest of
// 6/3/2/1 years whose price plus tip leaves the reserve floor intact, else the longest it can
// pay at all), then core's runway simulation over the adapter's rate range.
import { SECONDS_PER_YEAR, type Tier, runwayRange, tierRenewPrice } from '@spirith/core';
import type { VaultConstants } from '@/hooks/chain/use-vault';
import { tipFor } from '@/hooks/chain/use-vault';
import { type FundedRange, fundedRange } from './format';

const LADDER = [6n, 3n, 2n, 1n] as const;

export interface ProjectionInput {
  /** Earmark after the deposit, in USDC units. */
  readonly assets: bigint;
  readonly tier: Tier;
  readonly expiry: bigint;
  readonly constants: VaultConstants;
}

/** The block the vault would buy with `assets`, in years; 0n when not even a year is affordable. */
export function optimalBlockYears(assets: bigint, tier: Tier, constants: VaultConstants): bigint {
  const floor = constants.reserveYears * tierRenewPrice(tier, SECONDS_PER_YEAR);
  let affordable = 0n;
  for (const years of LADDER) {
    const price = tierRenewPrice(tier, years * SECONDS_PER_YEAR);
    const cost = price + tipFor(price, constants);
    if (assets >= cost + floor) return years;
    if (affordable === 0n && assets >= cost) affordable = years;
  }
  return affordable;
}

/** Funded-until range after a deposit; undefined when the earmark still cannot pay a year. */
export function projectFunding(input: ProjectionInput): FundedRange | undefined {
  const years = optimalBlockYears(input.assets, input.tier, input.constants);
  if (years === 0n) return undefined;
  const price = tierRenewPrice(input.tier, years * SECONDS_PER_YEAR);
  const range = runwayRange(
    {
      assets: input.assets,
      blockCost: price + tipFor(price, input.constants),
      blockYears: Number(years),
      reserve: input.constants.reserveYears * tierRenewPrice(input.tier, SECONDS_PER_YEAR),
    },
    input.constants.rateLowBps,
    input.constants.rateHighBps,
  );
  return fundedRange(
    input.expiry + BigInt(range.lowYears) * SECONDS_PER_YEAR,
    input.expiry + BigInt(range.highYears) * SECONDS_PER_YEAR,
    input.expiry,
  );
}
