import {
  type RiskBand,
  type SubgraphNameDetail,
  type SubgraphRenewal,
  fetchName,
  liveness,
} from '@spirith/core';
import {
  DAY,
  type ToolContext,
  type ToolResult,
  isoDate,
  pctRange,
  span,
  usdc,
  yearsUntil,
} from './context.js';

export interface RunwayData {
  readonly label: string;
  readonly found: boolean;
  readonly status: SubgraphNameDetail['status'] | 'unknown';
  readonly expiry: bigint | null;
  readonly deadline: bigint | null;
  readonly band: RiskBand | null;
  readonly endowed: boolean;
  readonly assets: bigint;
  readonly principal: bigint;
  readonly patrons: number;
  readonly recordWritten: boolean;
  readonly fundedUntilLow: bigint | null;
  readonly fundedUntilHigh: bigint | null;
  readonly runwayLowYears: number;
  readonly runwayHighYears: number;
  /** The block the vault would buy on the next renewal, in years; 0 when unaffordable. */
  readonly nextBlockYears: number;
  readonly rateAssumption: { readonly lowBps: number; readonly highBps: number };
  readonly renewalsViaSpirith: number;
  readonly lastRenewal: SubgraphRenewal | null;
}

/** Projected funded-until for one name, as a range, with the rate assumption stated. */
export async function runway(ctx: ToolContext, label: string): Promise<ToolResult<RunwayData>> {
  const now = ctx.now();
  const [name, vault, constants] = await Promise.all([
    fetchName(ctx.subgraph, label),
    ctx.chain.runwayOf(label),
    ctx.chain.constants(),
  ]);
  const rateAssumption = { lowBps: constants.rateLowBps, highBps: constants.rateHighBps };
  const endowed = vault.assets > 0n;
  const runwayLowYears = yearsUntil(now, vault.fundedUntilLow);
  const runwayHighYears = yearsUntil(now, vault.fundedUntilHigh);
  if (name == null) {
    return {
      data: {
        label,
        found: false,
        status: 'unknown',
        expiry: null,
        deadline: null,
        band: null,
        endowed,
        assets: vault.assets,
        principal: 0n,
        patrons: 0,
        recordWritten: false,
        fundedUntilLow: null,
        fundedUntilHigh: null,
        runwayLowYears,
        runwayHighYears,
        nextBlockYears: 0,
        rateAssumption,
        renewalsViaSpirith: 0,
        lastRenewal: null,
      },
      summary: `${label}.eth is not in the subgraph: never registered through the ENSv2 registry on this chain, or the index is behind.`,
    };
  }
  const l = liveness({ expiry: name.expiry, now, endowed, runwayLowYears });
  const renewalsViaSpirith = name.renewalEvents.filter(r => r.viaSpirith).length;
  const rate = pctRange(rateAssumption.lowBps, rateAssumption.highBps);
  const summary = endowed
    ? `${label}.eth expires ${isoDate(name.expiry)} and holds ${usdc(vault.assets)}; at ${rate} yield that keeps it funded until ${span(vault.fundedUntilLow, vault.fundedUntilHigh, isoDate)} (${span(runwayLowYears, runwayHighYears)} years). Band: ${l.band}.`
    : `${label}.eth expires ${isoDate(name.expiry)} (${l.daysToExpiry} days) and has no Spirith endowment. Band: ${l.band}.`;
  return {
    data: {
      label,
      found: true,
      status: name.status,
      expiry: name.expiry,
      deadline: l.deadline,
      band: l.band,
      endowed,
      assets: vault.assets,
      principal: name.endowmentDetail?.principal ?? 0n,
      patrons: name.endowmentDetail?.patronCount ?? 0,
      recordWritten: name.endowmentDetail?.recordWritten ?? false,
      fundedUntilLow: endowed ? vault.fundedUntilLow : null,
      fundedUntilHigh: endowed ? vault.fundedUntilHigh : null,
      runwayLowYears,
      runwayHighYears,
      nextBlockYears: Number(vault.duration / (365n * DAY)),
      rateAssumption,
      renewalsViaSpirith,
      lastRenewal: name.renewalEvents[0] ?? null,
    },
    summary,
  };
}
