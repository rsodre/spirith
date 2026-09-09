import type { SubgraphConfig } from '@spirith/core';
import { describe, expect, it } from 'vitest';
import type { ChainReader, VaultConstants, VaultRunway } from '../src/chain.js';
import { namesAtRisk, portfolioHealth, rescueProposal, runway } from '../src/tools/index.js';
import type { ToolContext } from '../src/tools/context.js';

const NOW = 1_800_000_000n;
const DAY = 86_400n;
const YEAR = 365n * DAY;

const CONSTANTS: VaultConstants = {
  depositCap: 100_000_000n,
  reserveYears: 2,
  renewLead: 30n * DAY,
  rateLowBps: 400,
  rateHighBps: 500,
  vault: '0x82c2f76c78CeBD8D9767F35f35de332d1991EEa0',
  usdc: '0x768F42455A2D082E23ceeF7d51e5787C82d67a39',
};

function fakeChain(runways: Record<string, VaultRunway>): ChainReader {
  return {
    async runwayOf(label) {
      return (
        runways[label] ?? { fundedUntilLow: 0n, fundedUntilHigh: 0n, assets: 0n, duration: 0n }
      );
    },
    async constants() {
      return CONSTANTS;
    },
  };
}

function subgraphReturning(byQueryName: Record<string, unknown>): SubgraphConfig {
  return {
    url: 'fake',
    fetch: (async (_url, init) => {
      const { query } = JSON.parse(String(init?.body)) as { query: string };
      const name = /query (\w+)/.exec(query)?.[1] ?? '';
      const data = byQueryName[name];
      if (data === undefined) throw new Error(`no fixture for ${name}`);
      return new Response(JSON.stringify({ data }));
    }) as typeof fetch,
  };
}

const wireName = (label: string, expiry: bigint, tier = 5, endowed = false) => ({
  id: '0x01',
  label,
  length: label.length,
  tier,
  owner: '0x62d48ea396a8bd7a5627bbab5969dd45db2b42c4',
  resolver: null,
  expiry: expiry.toString(),
  status: 'Registered',
  registeredAt: '1',
  renewals: 0,
  lastRenewedAt: null,
  endowment: endowed
    ? {
        principal: '50000000',
        shares: '50000000',
        patronCount: 1,
        renewals: 0,
        recordWritten: true,
      }
    : null,
});

function ctx(subgraph: SubgraphConfig, runways: Record<string, VaultRunway> = {}): ToolContext {
  return { subgraph, chain: fakeChain(runways), now: () => NOW };
}

describe('namesAtRisk', () => {
  it('ranks by band, then tier value, then time, and totals the value at risk', async () => {
    const c = ctx(
      subgraphReturning({
        Names: {
          names: [
            wireName('cheap-late', NOW + 20n * DAY),
            wireName('abc', NOW + 25n * DAY, 3),
            wireName('gone', NOW - 3n * DAY),
            wireName('funded', NOW + 5n * DAY, 5, true),
          ],
        },
      }),
      {
        funded: {
          fundedUntilLow: NOW + 30n * YEAR,
          fundedUntilHigh: NOW + 60n * YEAR,
          assets: 50_000_000n,
          duration: 6n * YEAR,
        },
      },
    );
    const { data, summary } = await namesAtRisk(c, { days: 28 });
    expect(data.names.map(n => n.label)).toEqual(['gone', 'abc', 'cheap-late', 'funded']);
    expect(data.names.map(n => n.band)).toEqual(['grace', 'urgent', 'urgent', 'endowed']);
    expect(data.valueAtRisk).toBe(640_000_005n + 2n * 8_000_021n);
    expect(data.byBand.endowed).toBe(1);
    expect(summary).toContain('4 names expire within 28 days');
  });
});

describe('runway', () => {
  it('reports the vault range and the rate assumption', async () => {
    const c = ctx(
      subgraphReturning({
        Name: {
          name: {
            ...wireName('spirithbeta', NOW + 6n * YEAR, 5, true),
            tokenId: '1',
            registeredBy: '0x62d48ea396a8bd7a5627bbab5969dd45db2b42c4',
            registrationAmount: '613701',
            registrations: 1,
            endowmentDetail: null,
            renewalEvents: [],
          },
        },
      }),
      {
        spirithbeta: {
          fundedUntilLow: NOW + 40n * YEAR,
          fundedUntilHigh: NOW + 70n * YEAR,
          assets: 22_729_929n,
          duration: 2n * YEAR,
        },
      },
    );
    const { data, summary } = await runway(c, 'spirithbeta');
    expect(data.runwayLowYears).toBe(40);
    expect(data.runwayHighYears).toBe(70);
    expect(data.nextBlockYears).toBe(2);
    expect(data.band).toBe('endowed');
    expect(summary).toContain('4–5% yield');
  });

  it('says when a name is unknown to the subgraph', async () => {
    const { data, summary } = await runway(
      ctx(subgraphReturning({ Name: { name: null } })),
      'nope',
    );
    expect(data.found).toBe(false);
    expect(summary).toContain('not in the subgraph');
  });
});

describe('rescueProposal', () => {
  it('proposes the shortfall to perpetuity when the cap allows, with the calls to make', async () => {
    const c = ctx(
      subgraphReturning({
        Name: {
          name: {
            ...wireName('abcdef', NOW + 10n * DAY, 5),
            tokenId: '1',
            registeredBy: '0x62d48ea396a8bd7a5627bbab5969dd45db2b42c4',
            registrationAmount: '0',
            registrations: 1,
            endowmentDetail: null,
            renewalEvents: [],
          },
        },
      }),
    );
    const { data, summary } = await rescueProposal(c, 'abcdef');
    expect(data.rescuable).toBe(true);
    // Perpetuity at 4% needs 144.76 USDC, above the 100 USDC cap: propose the cap.
    expect(data.perpetualWithinCap).toBe(false);
    expect(data.deposit).toBe(100_000_000n);
    expect(data.buysYearsLow).toBeGreaterThan(20);
    expect(data.call?.endow).toEqual(['abcdef', 100_000_000n]);
    expect(summary).toContain('testnet cap');
  });

  it('refuses a lapsed name', async () => {
    const c = ctx(
      subgraphReturning({
        Name: {
          name: {
            ...wireName('lapsed', NOW - 40n * DAY, 5),
            tokenId: '1',
            registeredBy: '0x62d48ea396a8bd7a5627bbab5969dd45db2b42c4',
            registrationAmount: '0',
            registrations: 1,
            endowmentDetail: null,
            renewalEvents: [],
          },
        },
      }),
    );
    const { data } = await rescueProposal(c, 'lapsed');
    expect(data.rescuable).toBe(false);
    expect(data.reasonNotRescuable).toContain('grace period is over');
  });
});

describe('portfolioHealth', () => {
  it('orders names by when they run dry', async () => {
    const patronage = (label: string, expiry: bigint) => ({
      patron: { id: '0x62d48ea396a8bd7a5627bbab5969dd45db2b42c4' },
      shares: '1',
      contributed: '50000000',
      withdrawn: '0',
      noticeShares: '0',
      noticeExecutableAt: null,
      endowment: {
        id: '0x01',
        label,
        principal: '50000000',
        name: { expiry: expiry.toString(), tier: 5 },
      },
    });
    const c = ctx(
      subgraphReturning({
        Patron: {
          patron: {
            id: '0x62d48ea396a8bd7a5627bbab5969dd45db2b42c4',
            contributed: '100000000',
            withdrawn: '0',
            namesSupported: 2,
            patronages: [patronage('long', NOW + YEAR), patronage('short', NOW + YEAR)],
          },
        },
      }),
      {
        long: {
          fundedUntilLow: NOW + 50n * YEAR,
          fundedUntilHigh: NOW + 80n * YEAR,
          assets: 60_000_000n,
          duration: 6n * YEAR,
        },
        short: {
          fundedUntilLow: NOW + 3n * YEAR,
          fundedUntilHigh: NOW + 4n * YEAR,
          assets: 20_000_000n,
          duration: YEAR,
        },
      },
    );
    const { data, summary } = await portfolioHealth(
      c,
      '0x62d48EA396a8BD7A5627BbAB5969DD45DB2b42c4',
    );
    expect(data.diesFirst).toBe('short');
    expect(data.names.map(n => n.label)).toEqual(['short', 'long']);
    expect(summary).toContain('short.eth runs dry first');
  });
});
