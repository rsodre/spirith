import {
  type Liveness,
  RISK_BANDS,
  type RiskBand,
  SECONDS_PER_YEAR,
  type SubgraphName,
  type Tier,
  fetchNamesAtRisk,
  liveness,
  tierRenewPrice,
} from '@spirith/core';
import { DAY, type ToolContext, type ToolResult, usdc, yearsUntil } from './context.js';

export interface NameAtRisk {
  readonly label: string;
  readonly tier: number;
  readonly expiry: bigint;
  readonly deadline: bigint;
  readonly daysToExpiry: number;
  readonly band: RiskBand;
  readonly reason: string;
  readonly endowed: boolean;
  readonly assets: bigint;
  /** Years the earmark covers at the low rate; 0 when unendowed. */
  readonly runwayLowYears: number;
  /** One year of renewal at list price: what it costs to keep this name alive. */
  readonly yearlyCost: bigint;
}

export interface NamesAtRiskInput {
  readonly days: number;
  readonly limit?: number;
  readonly endowedOnly?: boolean;
}

export interface NamesAtRiskData {
  readonly days: number;
  readonly total: number;
  readonly byBand: Readonly<Record<RiskBand, number>>;
  readonly valueAtRisk: bigint;
  readonly names: readonly NameAtRisk[];
}

const SEVERITY: Readonly<Record<RiskBand, number>> = Object.fromEntries(
  RISK_BANDS.map((band, i) => [band, i]),
) as Record<RiskBand, number>;

async function assess(ctx: ToolContext, name: SubgraphName, now: bigint): Promise<NameAtRisk> {
  const endowed = (name.endowment?.shares ?? 0n) > 0n;
  const runway = endowed ? await ctx.chain.runwayOf(name.label) : undefined;
  const runwayLowYears = runway ? yearsUntil(now, runway.fundedUntilLow) : 0;
  const l: Liveness = liveness({ expiry: name.expiry, now, endowed, runwayLowYears });
  return {
    label: name.label,
    tier: name.tier,
    expiry: name.expiry,
    deadline: l.deadline,
    daysToExpiry: l.daysToExpiry,
    band: l.band,
    reason: l.reason,
    endowed,
    assets: runway?.assets ?? 0n,
    runwayLowYears,
    yearlyCost: tierRenewPrice(name.tier as Tier, SECONDS_PER_YEAR),
  };
}

/** Names expiring within `days`, worst first: band, then price tier, then time. */
export async function namesAtRisk(
  ctx: ToolContext,
  input: NamesAtRiskInput,
): Promise<ToolResult<NamesAtRiskData>> {
  const now = ctx.now();
  const names = await fetchNamesAtRisk(ctx.subgraph, now, BigInt(input.days) * DAY, {
    first: 500,
    endowedOnly: input.endowedOnly,
  });
  const assessed = await Promise.all(names.map(n => assess(ctx, n, now)));
  assessed.sort(
    (a, b) =>
      SEVERITY[a.band] - SEVERITY[b.band] ||
      Number(b.yearlyCost - a.yearlyCost) ||
      Number(a.expiry - b.expiry),
  );
  const byBand = Object.fromEntries(RISK_BANDS.map(b => [b, 0])) as Record<RiskBand, number>;
  let valueAtRisk = 0n;
  for (const n of assessed) {
    byBand[n.band] += 1;
    if (n.band !== 'endowed') valueAtRisk += n.yearlyCost;
  }
  const limit = input.limit ?? 20;
  const unfunded = assessed.length - byBand.endowed;
  const summary =
    assessed.length === 0
      ? `No registered name expires in the next ${input.days} days.`
      : `${assessed.length} names expire within ${input.days} days (${byBand.grace} already in grace); ${unfunded} have no funded endowment, ${usdc(valueAtRisk)} of yearly renewals at risk. Worst first, showing ${Math.min(limit, assessed.length)}.`;
  return {
    data: {
      days: input.days,
      total: assessed.length,
      byBand,
      valueAtRisk,
      names: assessed.slice(0, limit),
    },
    summary,
  };
}
