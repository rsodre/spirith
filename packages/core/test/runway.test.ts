import { describe, expect, it } from 'vitest';
import { RUNWAY_HORIZON_YEARS, runwayRange, runwayYears } from '../src/runway.js';

const YEARLY_8 = 8_000_021n;
const SIX_YEAR_BLOCK = 27_000_071n;

describe('runwayYears', () => {
  it('with zero yield, covers exactly what the balance buys', () => {
    expect(
      runwayYears({ assets: 24_000_063n, blockCost: YEARLY_8, blockYears: 1, rateBps: 0 }),
    ).toBe(3);
  });

  it('is perpetual when yield exceeds the yearly cost', () => {
    const years = runwayYears({
      assets: 250_000_000n,
      blockCost: YEARLY_8,
      blockYears: 1,
      rateBps: 400,
    });
    expect(years).toBe(RUNWAY_HORIZON_YEARS);
  });

  // Paying six years upfront forgoes yield on that capital, so the naive $4.50 / 4% = $112.50
  // is not enough. Thresholds found by bisection on this function (spec §8).
  it('is perpetual from ~$129 at 4% with six-year blocks, not from $112.50', () => {
    const at = (assets: bigint) =>
      runwayYears({ assets, blockCost: SIX_YEAR_BLOCK, blockYears: 6, rateBps: 400 });
    expect(at(129_000_000n)).toBe(RUNWAY_HORIZON_YEARS);
    expect(at(128_000_000n)).toBeLessThan(RUNWAY_HORIZON_YEARS);
    expect(at(112_500_000n)).toBeLessThan(RUNWAY_HORIZON_YEARS);
  });

  it('is perpetual from ~$107 at 5% with six-year blocks', () => {
    const at = (assets: bigint) =>
      runwayYears({ assets, blockCost: SIX_YEAR_BLOCK, blockYears: 6, rateBps: 500 });
    expect(at(107_000_000n)).toBe(RUNWAY_HORIZON_YEARS);
    expect(at(106_000_000n)).toBeLessThan(RUNWAY_HORIZON_YEARS);
  });

  it('yearly renewals need ~$208 at 4%: six-year blocks are the cheaper cadence', () => {
    const at = (assets: bigint) =>
      runwayYears({ assets, blockCost: YEARLY_8, blockYears: 1, rateBps: 400 });
    expect(at(209_000_000n)).toBe(RUNWAY_HORIZON_YEARS);
    expect(at(207_000_000n)).toBeLessThan(RUNWAY_HORIZON_YEARS);
  });

  it('runs out when yield is below the cost', () => {
    const years = runwayYears({
      assets: 50_000_000n,
      blockCost: YEARLY_8,
      blockYears: 1,
      rateBps: 200,
    });
    expect(years, '$50 buys six $8 renewals at 2%').toBe(6);
  });
});

describe('runwayRange', () => {
  it('orders low before high', () => {
    const r = runwayRange({ assets: 50_000_000n, blockCost: YEARLY_8, blockYears: 1 }, 200, 500);
    expect(r.lowYears).toBeLessThanOrEqual(r.highYears);
    expect(r.perpetual).toBe(false);
  });
});
