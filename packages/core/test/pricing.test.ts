import { describe, expect, it } from 'vitest';
import {
  SECONDS_PER_YEAR,
  applyDiscount,
  effectiveYearlyCost,
  renewPrice,
  tierOf,
} from '../src/ens/pricing.js';

const DAY = 86_400n;

// Compatibility fence: these values were observed on the live Sepolia oracle and registrar
// on 2026-09-05. A red pin means the oracle changed, not that the fixture is wrong.
describe('renewPrice mirrors StandardRentPriceOracle', () => {
  it('prices a 5+ char name at $8/year', () => {
    expect(renewPrice('vitalik', SECONDS_PER_YEAR)).toBe(8_000_021n);
  });

  it('matches observed NameRegistered base amounts', () => {
    expect(renewPrice('chemokinesis', 1096n * DAY), '1096 days, 3y discount').toBe(16_515_112n);
    expect(renewPrice('oudenarde', 2192n * DAY), '2192 days, 6y discount').toBe(27_024_729n);
  });

  it('applies the tier ladder', () => {
    expect(renewPrice('abc', SECONDS_PER_YEAR)).toBe(640_000_005n);
    expect(renewPrice('abcd', SECONDS_PER_YEAR)).toBe(160_000_009n);
    expect(renewPrice('abcde', SECONDS_PER_YEAR)).toBe(8_000_021n);
  });

  it('applies discounts at 2, 3 and 6 years', () => {
    expect(renewPrice('abcde', 2n * SECONDS_PER_YEAR)).toBe(14_000_037n);
    expect(renewPrice('abcde', 3n * SECONDS_PER_YEAR)).toBe(16_500_044n);
    expect(renewPrice('abcde', 6n * SECONDS_PER_YEAR)).toBe(27_000_071n);
    expect(renewPrice('abcde', 7n * SECONDS_PER_YEAR), 'no step above 6y').toBe(31_500_083n);
  });

  it('rejects invalid labels', () => {
    expect(() => renewPrice('ab', SECONDS_PER_YEAR)).toThrow();
    expect(() => renewPrice('', SECONDS_PER_YEAR)).toThrow();
  });
});

describe('applyDiscount', () => {
  it('is identity below the first point', () => {
    expect(applyDiscount(1_000n, SECONDS_PER_YEAR)).toBe(1_000n);
  });
  it('floors like mulDiv', () => {
    expect(applyDiscount(1_001n, 2n * SECONDS_PER_YEAR)).toBe(875n);
  });
});

describe('effectiveYearlyCost', () => {
  it('drops to $4.50 at six years for a normal name', () => {
    expect(effectiveYearlyCost('abcde', 6n)).toBe(4_500_011n);
  });
});

describe('tierOf', () => {
  it('counts codepoints', () => {
    expect(tierOf('abc')).toBe(3);
    expect(tierOf('abcd')).toBe(4);
    expect(tierOf('abcdefgh')).toBe(5);
    expect(tierOf('🦄🦄🦄')).toBe(3);
    expect(() => tierOf('ab')).toThrow();
  });
});
