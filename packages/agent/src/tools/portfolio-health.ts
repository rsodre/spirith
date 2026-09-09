import { type RiskBand, fetchPatron, liveness } from '@spirith/core';
import type { Address } from 'viem';
import { type ToolContext, type ToolResult, isoDate, usdc, yearsUntil } from './context.js';

export interface PortfolioName {
  readonly label: string;
  readonly tier: number;
  readonly expiry: bigint;
  readonly band: RiskBand;
  readonly assets: bigint;
  readonly contributed: bigint;
  readonly shares: bigint;
  readonly noticeExecutableAt: bigint | null;
  readonly fundedUntilLow: bigint;
  readonly fundedUntilHigh: bigint;
  readonly runwayLowYears: number;
}

export interface PortfolioHealthData {
  readonly patron: Address;
  readonly found: boolean;
  readonly contributed: bigint;
  readonly withdrawn: bigint;
  readonly names: readonly PortfolioName[];
  readonly diesFirst: string | null;
}

/** Every name an address supports, soonest to run dry first. */
export async function portfolioHealth(
  ctx: ToolContext,
  address: Address,
): Promise<ToolResult<PortfolioHealthData>> {
  const now = ctx.now();
  const patron = await fetchPatron(ctx.subgraph, address);
  if (patron == null || patron.patronages.length === 0) {
    return {
      data: {
        patron: address,
        found: false,
        contributed: 0n,
        withdrawn: 0n,
        names: [],
        diesFirst: null,
      },
      summary: `${address} has no Spirith endowments.`,
    };
  }
  const names = await Promise.all(
    patron.patronages.map(async (p): Promise<PortfolioName> => {
      const vault = await ctx.chain.runwayOf(p.endowment.label);
      const runwayLowYears = yearsUntil(now, vault.fundedUntilLow);
      const l = liveness({ expiry: p.name.expiry, now, endowed: true, runwayLowYears });
      return {
        label: p.endowment.label,
        tier: p.name.tier,
        expiry: p.name.expiry,
        band: l.band,
        assets: vault.assets,
        contributed: p.contributed,
        shares: p.shares,
        noticeExecutableAt: p.noticeExecutableAt,
        fundedUntilLow: vault.fundedUntilLow,
        fundedUntilHigh: vault.fundedUntilHigh,
        runwayLowYears,
      };
    }),
  );
  names.sort((a, b) => Number(a.fundedUntilLow - b.fundedUntilLow));
  const first = names[0] as PortfolioName;
  const summary = `${address} supports ${names.length} name${names.length === 1 ? '' : 's'} with ${usdc(patron.contributed)} contributed. ${first.label}.eth runs dry first: funded until ${isoDate(first.fundedUntilLow)} at the low rate (${usdc(first.assets)} earmarked, band ${first.band}).`;
  return {
    data: {
      patron: address,
      found: true,
      contributed: patron.contributed,
      withdrawn: patron.withdrawn,
      names,
      diesFirst: first.label,
    },
    summary,
  };
}
