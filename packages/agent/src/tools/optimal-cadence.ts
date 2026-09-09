import { type Tier, tierOf } from '@spirith/core';
import { type Cadence, optimalCadence as compute } from '../optimiser/cadence.js';
import { DAY, type ToolContext, type ToolResult, usdc } from './context.js';

export interface OptimalCadenceInput {
  readonly label: string;
  /** What-if balance in USDC (6 decimals); defaults to the live earmark. */
  readonly assets?: bigint;
}

export interface OptimalCadenceData extends Cadence {
  readonly label: string;
  readonly tier: Tier;
  readonly assets: bigint;
  readonly rateAssumption: { readonly lowBps: number; readonly highBps: number };
  /** What the vault itself will buy on the next renewal, in years; 0 when unaffordable. */
  readonly vaultNextBlockYears: number;
}

/** Recommended renewal block for a name and why, next to what the vault will actually do. */
export async function optimalCadence(
  ctx: ToolContext,
  input: OptimalCadenceInput,
): Promise<ToolResult<OptimalCadenceData>> {
  const tier = tierOf(input.label);
  const [vault, constants] = await Promise.all([
    ctx.chain.runwayOf(input.label),
    ctx.chain.constants(),
  ]);
  const assets = input.assets ?? vault.assets;
  const cadence = compute({
    assets,
    tier,
    rateLowBps: constants.rateLowBps,
    rateHighBps: constants.rateHighBps,
    reserveYears: constants.reserveYears,
  });
  const vaultNextBlockYears = Number(vault.duration / (365n * DAY));
  const agrees = vaultNextBlockYears === cadence.recommended.years;
  const summary = `${cadence.explanation} The vault's own heuristic will buy ${
    vaultNextBlockYears === 0 ? 'nothing' : `a ${vaultNextBlockYears}-year block`
  } for ${input.label}.eth at the next renewal${agrees ? ', which agrees' : `; with ${usdc(assets)} it prefers keeping the reserve intact`}.`;
  return {
    data: {
      ...cadence,
      label: input.label,
      tier,
      assets,
      rateAssumption: { lowBps: constants.rateLowBps, highBps: constants.rateHighBps },
      vaultNextBlockYears,
    },
    summary,
  };
}
