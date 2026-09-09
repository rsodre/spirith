import { RUNWAY_HORIZON_YEARS } from '@spirith/core';
import { describe, expect, it } from 'vitest';
import { optimalCadence, perpetualDeposit } from '../src/optimiser/cadence.js';

const USDC = 1_000_000n;

describe('optimalCadence', () => {
  it('prices the blocks off the live discount points', () => {
    const c = optimalCadence({ assets: 200n * USDC, tier: 5, rateLowBps: 400, rateHighBps: 500 });
    expect(c.options.map(o => o.years)).toEqual([1, 2, 3, 6]);
    expect(c.options.map(o => o.discountPct)).toEqual([0, 12.5, 31.25, 43.75]);
    expect(c.options[0]?.blockCost).toBe(8_000_021n);
    expect(c.options[3]?.blockCost).toBe(27_000_071n);
    expect(c.reserve).toBe(16_000_042n);
  });

  it('recommends six-year blocks once the balance sustains them', () => {
    const c = optimalCadence({ assets: 200n * USDC, tier: 5, rateLowBps: 400, rateHighBps: 500 });
    expect(c.recommended.years).toBe(6);
    expect(c.recommended.runway.perpetual).toBe(true);
    expect(c.explanation).toContain('6-year blocks');
  });

  it('recommends the longest affordable runway when six years is out of reach', () => {
    // 20 USDC: six years (27.00) is unaffordable; three years (16.52) beats two and one.
    const c = optimalCadence({ assets: 20n * USDC, tier: 5, rateLowBps: 400, rateHighBps: 500 });
    expect(c.options[3]?.affordableNow).toBe(false);
    expect(c.recommended.years).toBe(3);
    expect(c.recommended.affordableNow).toBe(true);
    for (const o of c.options) {
      expect(c.recommended.runway.lowYears).toBeGreaterThanOrEqual(o.runway.lowYears);
    }
  });

  it('says so when one year is unaffordable', () => {
    const c = optimalCadence({ assets: 5n * USDC, tier: 5, rateLowBps: 400, rateHighBps: 500 });
    expect(c.recommended.runway.lowYears).toBe(0);
    expect(c.explanation).toContain('less than one year');
  });
});

describe('perpetualDeposit', () => {
  // The reserve earns nothing, which is why these sit above the handover's no-reserve figures
  // (128.76 at 4%, 106.39 at 5%). Measured 2026-09-08 on the live discount points.
  it('finds the perpetual threshold for a five-letter name', () => {
    expect(perpetualDeposit({ tier: 5, years: 6, rateBps: 400 })).toBe(144_764_678n);
    expect(perpetualDeposit({ tier: 5, years: 6, rateBps: 500 })).toBe(122_389_761n);
    expect(perpetualDeposit({ tier: 5, years: 6, rateBps: 400, reserveYears: 0 })).toBe(
      128_764_636n,
    );
    expect(perpetualDeposit({ tier: 5, years: 1, rateBps: 400 })).toBe(224_000_588n);
  });

  it('is exact: one unit less falls short of the horizon', () => {
    const at = perpetualDeposit({ tier: 5, years: 6, rateBps: 400 });
    const c = (assets: bigint) =>
      optimalCadence({ assets, tier: 5, rateLowBps: 400, rateHighBps: 400 }).options[3]?.runway
        .lowYears;
    expect(c(at)).toBe(RUNWAY_HORIZON_YEARS);
    expect(c(at - 1n)).toBeLessThan(RUNWAY_HORIZON_YEARS);
  });

  it('scales with the tier: three-letter names need about eighty times more', () => {
    const three = perpetualDeposit({ tier: 3, years: 6, rateBps: 400 });
    const five = perpetualDeposit({ tier: 5, years: 6, rateBps: 400 });
    expect(Number(three) / Number(five)).toBeCloseTo(80, 0);
  });
});
