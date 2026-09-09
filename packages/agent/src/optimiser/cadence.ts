// Renewal cadence against the ENSv2 duration-discount curve (HANDOVER §6). Pure: no chain, no
// subgraph. Longer blocks are cheaper per year but the capital spent stops earning, and the
// vault's reserve (RESERVE_YEARS × one year) never earns at all, so the answer depends on the
// balance, the rate range and the tier.
import {
  DISCOUNT_POINTS,
  type DiscountPoint,
  RUNWAY_HORIZON_YEARS,
  type RunwayRange,
  SECONDS_PER_YEAR,
  type Tier,
  runwayRange,
  runwayYears,
  tierRenewPrice,
} from '@spirith/core';

export const BLOCK_YEARS = [1, 2, 3, 6] as const;
export type BlockYears = (typeof BLOCK_YEARS)[number];

/** What the deployed vault keeps liquid: two one-year renewals. */
export const DEFAULT_RESERVE_YEARS = 2;

export interface CadenceInput {
  /** USDC earmarked for the name, 6 decimals. */
  readonly assets: bigint;
  readonly tier: Tier;
  readonly rateLowBps: number;
  readonly rateHighBps: number;
  readonly reserveYears?: number;
  readonly discountPoints?: readonly DiscountPoint[];
}

export interface CadenceOption {
  readonly years: BlockYears;
  readonly blockCost: bigint;
  readonly effectiveYearly: bigint;
  /** Discount off the one-year price, in percent. */
  readonly discountPct: number;
  readonly affordableNow: boolean;
  readonly runway: RunwayRange;
}

export interface Cadence {
  readonly recommended: CadenceOption;
  readonly options: readonly CadenceOption[];
  readonly reserve: bigint;
  readonly explanation: string;
}

function discountPct(points: readonly DiscountPoint[], years: number): number {
  let numer = 0n;
  for (const p of points) {
    if (BigInt(years) * SECONDS_PER_YEAR < p.duration) break;
    numer = p.numer;
  }
  if (numer === 0n) return 0;
  return Number(10_000n - (numer * 10_000n) / 10n ** 38n) / 100;
}

/** Strategy with the longest runway at the low rate; ties go to the longer, cheaper block. */
export function optimalCadence(input: CadenceInput): Cadence {
  const points = input.discountPoints ?? DISCOUNT_POINTS;
  const yearly = tierRenewPrice(input.tier, SECONDS_PER_YEAR);
  const reserve = BigInt(input.reserveYears ?? DEFAULT_RESERVE_YEARS) * yearly;
  const options: CadenceOption[] = BLOCK_YEARS.map(years => {
    const blockCost = tierRenewPrice(input.tier, BigInt(years) * SECONDS_PER_YEAR);
    return {
      years,
      blockCost,
      effectiveYearly: blockCost / BigInt(years),
      discountPct: discountPct(points, years),
      affordableNow: input.assets >= blockCost,
      runway: runwayRange(
        { assets: input.assets, blockCost, blockYears: years, reserve },
        input.rateLowBps,
        input.rateHighBps,
      ),
    };
  });
  let recommended = options[0] as CadenceOption;
  for (const o of options) {
    if (o.runway.lowYears >= recommended.runway.lowYears) recommended = o;
  }
  return { recommended, options, reserve, explanation: explain(input, recommended, options) };
}

function usdc(units: bigint): string {
  return `${(Number(units) / 1e6).toFixed(2)} USDC`;
}

function span(low: number, high: number): string {
  return low === high ? String(low) : `${low}–${high}`;
}

function explain(
  input: CadenceInput,
  best: CadenceOption,
  options: readonly CadenceOption[],
): string {
  const oneYear = options[0] as CadenceOption;
  const rate =
    input.rateLowBps === input.rateHighBps
      ? `${input.rateLowBps / 100}%`
      : `${input.rateLowBps / 100}–${input.rateHighBps / 100}%`;
  if (!oneYear.affordableNow) {
    return `The earmark holds ${usdc(input.assets)}, less than one year at ${usdc(oneYear.blockCost)}. Nothing can be renewed until it is topped up.`;
  }
  const horizon = best.runway.perpetual
    ? `keeps the name alive indefinitely at ${rate}`
    : `covers ${span(best.runway.lowYears, best.runway.highYears)} years at ${rate}`;
  if (best.years === 1) {
    return `Renew one year at a time (${usdc(best.blockCost)}). With ${usdc(input.assets)} the discounted blocks are unaffordable or would strip the reserve, so yearly renewal ${horizon}.`;
  }
  return `Renew in ${best.years}-year blocks at ${usdc(best.blockCost)}, ${best.discountPct}% off the yearly price (${usdc(best.effectiveYearly)} per year instead of ${usdc(oneYear.blockCost)}). With ${usdc(input.assets)} that ${horizon}; yearly renewal would cover ${span(oneYear.runway.lowYears, oneYear.runway.highYears)}. Capital spent on a block stops earning, which is why a longer block is not always better.`;
}

export interface PerpetualDepositInput {
  readonly tier: Tier;
  readonly years: BlockYears;
  readonly rateBps: number;
  readonly reserveYears?: number;
}

/** Smallest earmark that keeps a name alive to the horizon at `rateBps`, found by bisection. */
export function perpetualDeposit(input: PerpetualDepositInput): bigint {
  const yearly = tierRenewPrice(input.tier, SECONDS_PER_YEAR);
  const blockCost = tierRenewPrice(input.tier, BigInt(input.years) * SECONDS_PER_YEAR);
  const reserve = BigInt(input.reserveYears ?? DEFAULT_RESERVE_YEARS) * yearly;
  const sustains = (assets: bigint) =>
    runwayYears({ assets, blockCost, blockYears: input.years, rateBps: input.rateBps, reserve }) >=
    RUNWAY_HORIZON_YEARS;
  let lo = 0n;
  let hi = blockCost * 2000n;
  if (!sustains(hi)) return hi;
  while (hi - lo > 1n) {
    const mid = (lo + hi) / 2n;
    if (sustains(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}
