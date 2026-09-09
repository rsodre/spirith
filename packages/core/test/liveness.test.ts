import { describe, expect, it } from 'vitest';
import { DAY, liveness } from '../src/liveness.js';
import { GRACE_PERIOD_SECONDS } from '../src/subgraph/queries.js';

const NOW = 1_800_000_000n;
const at = (days: number) => NOW + BigInt(days) * DAY;

describe('liveness bands', () => {
  it('lapses once the 28-day grace is over', () => {
    const l = liveness({ expiry: NOW - GRACE_PERIOD_SECONDS, now: NOW, endowed: true });
    expect(l.band).toBe('lapsed');
    expect(l.deadline).toBe(NOW);
  });

  it('is in grace between expiry and the deadline, even when endowed', () => {
    const l = liveness({ expiry: NOW - 1n, now: NOW, endowed: true, runwayLowYears: 50 });
    expect(l.band).toBe('grace');
    expect(l.daysToExpiry).toBe(-1);
  });

  it('bands unendowed names by days to expiry', () => {
    expect(liveness({ expiry: at(6), now: NOW, endowed: false }).band).toBe('critical');
    expect(liveness({ expiry: at(7), now: NOW, endowed: false }).band).toBe('urgent');
    expect(liveness({ expiry: at(27), now: NOW, endowed: false }).band).toBe('urgent');
    expect(liveness({ expiry: at(28), now: NOW, endowed: false }).band).toBe('watch');
    expect(liveness({ expiry: at(90), now: NOW, endowed: false }).band).toBe('safe');
  });

  it('marks an endowed name with a year of runway as endowed, regardless of expiry', () => {
    const l = liveness({ expiry: at(3), now: NOW, endowed: true, runwayLowYears: 1 });
    expect(l.band).toBe('endowed');
  });

  it('keeps time banding for an underfunded endowment and says so', () => {
    const l = liveness({ expiry: at(3), now: NOW, endowed: true, runwayLowYears: 0 });
    expect(l.band).toBe('critical');
    expect(l.reason).toContain('underfunded');
  });

  it('counts whole days, rounding towards the deadline', () => {
    expect(liveness({ expiry: at(2) + 1n, now: NOW, endowed: false }).daysToExpiry).toBe(2);
    expect(liveness({ expiry: at(-2) - 1n, now: NOW, endowed: false }).daysToExpiry).toBe(-3);
  });
});
