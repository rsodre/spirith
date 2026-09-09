// Display formatting lives at the edge. Domain code hands out bigint and unix seconds; these
// turn them into strings, and nothing else in the app formats a number by hand.
import { RUNWAY_HORIZON_YEARS, SECONDS_PER_YEAR } from '@spirith/core';
import type { Address, Hex } from 'viem';

const USDC_DECIMALS = 6n;
const USDC_UNIT = 10n ** USDC_DECIMALS;

/** `1234567n` → "1.23"; `digits` decimals, no unit. */
export function formatUsdc(units: bigint, digits = 2): string {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const whole = abs / USDC_UNIT;
  const fraction = (abs % USDC_UNIT).toString().padStart(6, '0').slice(0, digits);
  const wholeText = whole.toLocaleString('en-US');
  return `${negative ? '-' : ''}${wholeText}${digits > 0 ? `.${fraction}` : ''}`;
}

/** "12.50" → 12_500_000n; throws on anything that is not a positive decimal. */
export function parseUsdc(text: string): bigint {
  const m = /^\s*(\d+)(?:\.(\d{0,6}))?\s*$/.exec(text);
  if (!m) throw new Error('enter an amount like 25 or 12.50');
  const whole = BigInt(m[1] ?? '0');
  const fraction = BigInt((m[2] ?? '').padEnd(6, '0'));
  return whole * USDC_UNIT + fraction;
}

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(unix: bigint): string {
  return DATE.format(new Date(Number(unix) * 1000));
}

export function formatDateTime(unix: bigint): string {
  return DATE_TIME.format(new Date(Number(unix) * 1000));
}

export function yearOf(unix: bigint): number {
  return new Date(Number(unix) * 1000).getUTCFullYear();
}

/** Whole years in a duration, or the seconds when it is not a whole number of years. */
export function formatDuration(seconds: bigint): string {
  if (seconds % SECONDS_PER_YEAR === 0n) {
    const years = seconds / SECONDS_PER_YEAR;
    return years === 1n ? '1 year' : `${years} years`;
  }
  const days = seconds / 86_400n;
  return days === 1n ? '1 day' : `${days} days`;
}

export function formatDays(days: number): string {
  const abs = Math.abs(days);
  return abs === 1 ? '1 day' : `${abs} days`;
}

export function shortAddress(address: Address): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function shortHash(hash: Hex): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

/** Whole years from `now` to `until`, floored; never negative. */
export function yearsUntil(now: bigint, until: bigint): number {
  return until > now ? Number((until - now) / SECONDS_PER_YEAR) : 0;
}

export interface FundedRange {
  readonly low: bigint;
  readonly high: bigint;
  /** The vault reports `expiry + 500 years` when the earmark sustains itself. */
  readonly perpetual: boolean;
  readonly text: string;
}

/** Honest UI rule: a range of years, never a date, and "indefinitely" past the horizon. */
export function fundedRange(low: bigint, high: bigint, expiry: bigint): FundedRange {
  const horizon = expiry + BigInt(RUNWAY_HORIZON_YEARS) * SECONDS_PER_YEAR;
  const perpetual = low >= horizon;
  const lowYear = yearOf(low);
  const highYear = yearOf(high);
  const text = perpetual
    ? 'indefinitely at current rates'
    : high >= horizon
      ? `through ${lowYear}, possibly indefinitely`
      : lowYear === highYear
        ? `through ${lowYear}`
        : `through ${lowYear}–${highYear}`;
  return { low, high, perpetual, text };
}

export function formatRate(lowBps: number, highBps: number): string {
  return lowBps === highBps ? `${lowBps / 100}%` : `${lowBps / 100}–${highBps / 100}%`;
}

export function tierLabel(tier: number): string {
  return tier >= 5 ? '5+ characters' : `${tier} characters`;
}
