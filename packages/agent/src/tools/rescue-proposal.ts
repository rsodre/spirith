import {
  GRACE_PERIOD_SECONDS,
  type RiskBand,
  SECONDS_PER_YEAR,
  type Tier,
  fetchName,
  liveness,
  runwayRange,
  tierOf,
  tierRenewPrice,
} from '@spirith/core';
import type { Address } from 'viem';
import { optimalCadence, perpetualDeposit } from '../optimiser/cadence.js';
import { type ToolContext, type ToolResult, isoDate, span, usdc, yearsUntil } from './context.js';

export interface RescueProposalData {
  readonly label: string;
  readonly tier: Tier;
  readonly rescuable: boolean;
  readonly reasonNotRescuable: string | null;
  readonly expiry: bigint | null;
  readonly deadline: bigint | null;
  readonly band: RiskBand | null;
  readonly assets: bigint;
  readonly depositCap: bigint;
  /** Earmark that keeps the name alive indefinitely at the low rate with the best block. */
  readonly perpetualAt: bigint;
  /** Deposit proposed now: the perpetual shortfall, or what the cap still allows. */
  readonly deposit: bigint;
  readonly perpetualWithinCap: boolean;
  /** After the deposit, at the low and high rate. */
  readonly buysYearsLow: number;
  readonly buysYearsHigh: number;
  readonly buysBlockYears: number;
  readonly yearlyCost: bigint;
  readonly call: {
    readonly usdc: Address;
    readonly vault: Address;
    readonly approve: readonly [spender: Address, amount: bigint];
    readonly endow: readonly [label: string, amount: bigint];
  } | null;
}

/** How much a name needs, what that buys, and the exact calls to make. */
export async function rescueProposal(
  ctx: ToolContext,
  label: string,
): Promise<ToolResult<RescueProposalData>> {
  const tier = tierOf(label);
  const now = ctx.now();
  const [name, vault, constants] = await Promise.all([
    fetchName(ctx.subgraph, label),
    ctx.chain.runwayOf(label),
    ctx.chain.constants(),
  ]);
  const yearlyCost = tierRenewPrice(tier, SECONDS_PER_YEAR);
  const cadence = optimalCadence({
    assets: constants.depositCap,
    tier,
    rateLowBps: constants.rateLowBps,
    rateHighBps: constants.rateHighBps,
    reserveYears: constants.reserveYears,
  });
  const block = cadence.recommended.years;
  const perpetualAt = perpetualDeposit({
    tier,
    years: block,
    rateBps: constants.rateLowBps,
    reserveYears: constants.reserveYears,
  });
  const base = {
    label,
    tier,
    assets: vault.assets,
    depositCap: constants.depositCap,
    perpetualAt,
    yearlyCost,
  };
  const notRescuable = (reason: string): ToolResult<RescueProposalData> => ({
    data: {
      ...base,
      rescuable: false,
      reasonNotRescuable: reason,
      expiry: name?.expiry ?? null,
      deadline: name ? name.expiry + GRACE_PERIOD_SECONDS : null,
      band: null,
      deposit: 0n,
      perpetualWithinCap: false,
      buysYearsLow: 0,
      buysYearsHigh: 0,
      buysBlockYears: 0,
      call: null,
    },
    summary: `${label}.eth cannot be rescued: ${reason}`,
  });
  if (name == null) return notRescuable('it is not in the subgraph.');
  if (name.status !== 'Registered') return notRescuable('the registry has released it.');
  const l = liveness({ expiry: name.expiry, now, endowed: vault.assets > 0n });
  if (l.band === 'lapsed') {
    return notRescuable(
      `it expired on ${isoDate(name.expiry)} and the 28-day grace period is over.`,
    );
  }
  const room = constants.depositCap > vault.assets ? constants.depositCap - vault.assets : 0n;
  const shortfall = perpetualAt > vault.assets ? perpetualAt - vault.assets : 0n;
  const perpetualWithinCap = shortfall <= room;
  const deposit = perpetualWithinCap ? shortfall : room;
  const after = optimalCadence({
    assets: vault.assets + deposit,
    tier,
    rateLowBps: constants.rateLowBps,
    rateHighBps: constants.rateHighBps,
    reserveYears: constants.reserveYears,
  }).recommended;
  const buys = runwayRange(
    {
      assets: vault.assets + deposit,
      blockCost: after.blockCost,
      blockYears: after.years,
      reserve: cadence.reserve,
    },
    constants.rateLowBps,
    constants.rateHighBps,
  );
  const call =
    deposit > 0n
      ? {
          usdc: constants.usdc,
          vault: constants.vault,
          approve: [constants.vault, deposit] as const,
          endow: [label, deposit] as const,
        }
      : null;
  const rate = `${constants.rateLowBps / 100}%`;
  const urgency =
    l.band === 'grace'
      ? `${label}.eth expired on ${isoDate(name.expiry)} and can still be renewed until ${isoDate(l.deadline)}.`
      : `${label}.eth expires on ${isoDate(name.expiry)} (${l.daysToExpiry} days).`;
  const what = buys.perpetual
    ? `keeps it alive indefinitely at ${rate}`
    : `covers ${span(buys.lowYears, buys.highYears)} years`;
  const summary =
    deposit === 0n
      ? `${label}.eth already holds ${usdc(vault.assets)}, ${buys.perpetual ? 'enough for perpetuity' : `${span(buys.lowYears, buys.highYears)} years`}; the ${usdc(constants.depositCap)} cap leaves no room for more. ${urgency}`
      : `${urgency} Endow ${usdc(deposit)} (it holds ${usdc(vault.assets)}, perpetuity at ${rate} needs ${usdc(perpetualAt)}${perpetualWithinCap ? '' : `, more than the ${usdc(constants.depositCap)} testnet cap allows`}). That ${what} in ${after.years}-year blocks. Approve the vault for that amount of USDC, then call endow("${label}", ${deposit}); anyone may do it. ${yearsUntil(now, name.expiry) === 0 ? 'The keeper can renew as soon as the money lands.' : ''}`.trim();
  return {
    data: {
      ...base,
      rescuable: true,
      reasonNotRescuable: null,
      expiry: name.expiry,
      deadline: l.deadline,
      band: l.band,
      deposit,
      perpetualWithinCap,
      buysYearsLow: buys.lowYears,
      buysYearsHigh: buys.highYears,
      buysBlockYears: after.years,
      call,
    },
    summary,
  };
}
