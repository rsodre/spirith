// Read-time liveness banding (spec §5 LivenessScore). Nothing here is stored: the subgraph
// keeps the inputs and this function turns them into a band at the moment of reading, so a
// score can never be stale.
import { GRACE_PERIOD_SECONDS } from './subgraph/queries.js';

export const DAY = 86_400n;

/** Ordered worst to best. */
export const RISK_BANDS = [
  'lapsed',
  'grace',
  'critical',
  'urgent',
  'watch',
  'safe',
  'endowed',
] as const;
export type RiskBand = (typeof RISK_BANDS)[number];

export interface LivenessInput {
  /** Name expiry, unix seconds. */
  readonly expiry: bigint;
  /** Unix seconds. */
  readonly now: bigint;
  /** Whether a live Spirith endowment exists for the name. */
  readonly endowed: boolean;
  /** Low end of the endowment's runway, in years from now; only read when `endowed`. */
  readonly runwayLowYears?: number;
}

export interface Liveness {
  readonly band: RiskBand;
  /** Negative once expired. */
  readonly daysToExpiry: number;
  /** Last second the name can still be renewed: expiry + 28 days. */
  readonly deadline: bigint;
  readonly reason: string;
}

export const CRITICAL_DAYS = 7;
export const URGENT_DAYS = 28;
export const WATCH_DAYS = 90;

export function liveness(input: LivenessInput): Liveness {
  const deadline = input.expiry + GRACE_PERIOD_SECONDS;
  const secondsLeft = input.expiry - input.now;
  const daysToExpiry =
    Number(secondsLeft / DAY) - (secondsLeft < 0n && secondsLeft % DAY !== 0n ? 1 : 0);
  const done = (band: RiskBand, reason: string): Liveness => ({
    band,
    daysToExpiry,
    deadline,
    reason,
  });

  if (input.now >= deadline) return done('lapsed', 'past the 28-day grace period');
  if (input.now >= input.expiry) {
    return done('grace', `expired, ${Number((deadline - input.now) / DAY)} days of grace left`);
  }
  if (input.endowed && (input.runwayLowYears ?? 0) >= 1) {
    return done('endowed', `endowed, funded for at least ${input.runwayLowYears} more years`);
  }
  const suffix = input.endowed ? ' (endowed, but underfunded)' : '';
  if (daysToExpiry < CRITICAL_DAYS)
    return done('critical', `expires in ${daysToExpiry} days${suffix}`);
  if (daysToExpiry < URGENT_DAYS) return done('urgent', `expires in ${daysToExpiry} days${suffix}`);
  if (daysToExpiry < WATCH_DAYS) return done('watch', `expires in ${daysToExpiry} days${suffix}`);
  return done('safe', `expires in ${daysToExpiry} days${suffix}`);
}
