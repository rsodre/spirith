import type { SubgraphConfig } from '@spirith/core';
import type { ChainReader } from '../chain.js';

/** Everything a tool needs; the MCP layer and tests build one. */
export interface ToolContext {
  readonly subgraph: SubgraphConfig;
  readonly chain: ChainReader;
  readonly now: () => bigint;
}

export interface ToolResult<T> {
  readonly data: T;
  /** One or two sentences a human can read without the JSON. */
  readonly summary: string;
}

export const DAY = 86_400n;
export const YEAR = 365n * DAY;

export function usdc(units: bigint): string {
  return `${(Number(units) / 1e6).toFixed(2)} USDC`;
}

export function isoDate(unix: bigint): string {
  return new Date(Number(unix) * 1000).toISOString().slice(0, 10);
}

/** Whole years from `now` to `until`, floored; never negative. */
export function yearsUntil(now: bigint, until: bigint): number {
  return until > now ? Number((until - now) / YEAR) : 0;
}

/** "4%" when both ends agree, "4–5%" otherwise; the mock adapter reports a single rate. */
export function pctRange(lowBps: number, highBps: number): string {
  return lowBps === highBps ? `${lowBps / 100}%` : `${lowBps / 100}–${highBps / 100}%`;
}

export function span<T>(low: T, high: T, render: (v: T) => string = String): string {
  return low === high ? render(low) : `${render(low)}–${render(high)}`;
}
