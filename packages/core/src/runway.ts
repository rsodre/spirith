// Funded-until projection. Honest UI rule (spec §4.4): with a variable rate, quote a range.

export const RUNWAY_HORIZON_YEARS = 500;

export interface RunwayInput {
  /** Assets earmarked for the name, in token units. */
  readonly assets: bigint;
  /** Cost of one renewal block, in token units. */
  readonly blockCost: bigint;
  /** Years bought by one renewal block. */
  readonly blockYears: number;
  /** Annual yield in basis points. */
  readonly rateBps: number;
  /** Assets kept liquid and earning nothing (the vault's reserve buffer). Default 0. */
  readonly reserve?: bigint;
}

/**
 * Years of coverage from now, simulating yearly compounding and a renewal purchase every
 * `blockYears`. Returns RUNWAY_HORIZON_YEARS when the endowment is self-sustaining.
 */
export function runwayYears(input: RunwayInput): number {
  const { blockCost, blockYears } = input;
  if (blockCost <= 0n || blockYears <= 0) throw new Error('invalid renewal block');
  const rate = BigInt(input.rateBps);
  const reserve = input.reserve ?? 0n;
  let assets = input.assets;
  let coveredUntil = 0;
  for (let year = 0; year < RUNWAY_HORIZON_YEARS; year++) {
    if (coveredUntil <= year) {
      if (assets < blockCost) return coveredUntil;
      assets -= blockCost;
      coveredUntil = year + blockYears;
    }
    const earning = assets > reserve ? assets - reserve : 0n;
    assets += (earning * rate) / 10_000n;
  }
  return RUNWAY_HORIZON_YEARS;
}

export interface RunwayRange {
  readonly lowYears: number;
  readonly highYears: number;
  readonly perpetual: boolean;
}

export function runwayRange(
  input: Omit<RunwayInput, 'rateBps'>,
  rateLowBps: number,
  rateHighBps: number,
): RunwayRange {
  const lowYears = runwayYears({ ...input, rateBps: rateLowBps });
  const highYears = runwayYears({ ...input, rateBps: rateHighBps });
  return { lowYears, highYears, perpetual: lowYears >= RUNWAY_HORIZON_YEARS };
}
