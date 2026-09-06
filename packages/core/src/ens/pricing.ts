// Mirrors StandardRentPriceOracle exactly (spec §2). Values are in the oracle's base unit,
// 1e-12 dollars; `toAmount` converts to a payment token's smallest unit. Pinned by
// test/pricing.test.ts against amounts observed on-chain; a red pin means the oracle changed.

export const SECONDS_PER_YEAR = 365n * 86_400n;

/** Base rate per second by label length (1-indexed, capped at 5). Zero means invalid. */
export const BASE_RATE_PER_SECOND: readonly bigint[] = [0n, 0n, 20_294_267n, 5_073_567n, 253_679n];

export const DISCOUNT_DENOMINATOR = 10n ** 38n;

export interface DiscountPoint {
  readonly duration: bigint;
  readonly numer: bigint;
}

/** Live oracle discount points: pay 87.5% at 2y, 68.75% at 3y, 56.25% at 6y. */
export const DISCOUNT_POINTS: readonly DiscountPoint[] = [
  { duration: 2n * SECONDS_PER_YEAR, numer: 875n * 10n ** 35n },
  { duration: 3n * SECONDS_PER_YEAR, numer: 6875n * 10n ** 34n },
  { duration: 6n * SECONDS_PER_YEAR, numer: 5625n * 10n ** 34n },
];

export interface PaymentRatio {
  readonly numer: bigint;
  readonly denom: bigint;
}

/** Six-decimal dollar stablecoins (MockUSDC, Circle USDC). */
export const USDC_RATIO: PaymentRatio = { numer: 1n, denom: 1_000_000n };

export type Tier = 3 | 4 | 5;

/** Codepoint count, as the oracle's `getLength`. */
export function labelLength(label: string): number {
  return Array.from(label).length;
}

export function tierOf(label: string): Tier {
  const n = labelLength(label);
  if (n < 3) throw new Error(`label too short: ${label}`);
  return n >= 5 ? 5 : (n as Tier);
}

export function applyDiscount(
  value: bigint,
  duration: bigint,
  points: readonly DiscountPoint[] = DISCOUNT_POINTS,
): bigint {
  let numer = 0n;
  for (const p of points) {
    if (duration < p.duration) break;
    numer = p.numer;
  }
  return numer === 0n ? value : (value * numer) / DISCOUNT_DENOMINATOR;
}

export function basePrice(label: string, duration: bigint): bigint {
  const n = labelLength(label);
  if (n === 0 || n > 255) return 0n;
  const rate = BASE_RATE_PER_SECOND[Math.min(n, BASE_RATE_PER_SECOND.length) - 1] ?? 0n;
  return applyDiscount(rate * duration, duration);
}

/** Ceil-rounded conversion from base units to token units, as the oracle's `_toAmount`. */
export function toAmount(value: bigint, ratio: PaymentRatio = USDC_RATIO): bigint {
  if (ratio.numer === ratio.denom) return value;
  const num = value * ratio.numer;
  return (num + ratio.denom - 1n) / ratio.denom;
}

/** Renewal price in token units. Throws for invalid labels, as the oracle reverts. */
export function renewPrice(
  label: string,
  duration: bigint,
  ratio: PaymentRatio = USDC_RATIO,
): bigint {
  const base = basePrice(label, duration);
  if (base === 0n) throw new Error(`label not valid: ${label}`);
  return toAmount(base, ratio);
}

/** Effective per-year cost when renewing in blocks of `years`. */
export function effectiveYearlyCost(
  label: string,
  years: bigint,
  ratio: PaymentRatio = USDC_RATIO,
): bigint {
  return renewPrice(label, years * SECONDS_PER_YEAR, ratio) / years;
}
