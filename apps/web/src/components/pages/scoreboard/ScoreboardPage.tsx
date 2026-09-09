'use client';

import { useMemo } from 'react';
import {
  type RiskBand,
  type SubgraphName,
  SECONDS_PER_YEAR,
  type Tier,
  liveness,
  tierRenewPrice,
} from '@spirith/core';
import { useVaultRunways } from '@/hooks/chain/use-vault';
import { useNamesAtRisk } from '@/hooks/queries/use-names-at-risk';
import { useNamespace } from '@/hooks/queries/use-namespace';
import { useNow } from '@/hooks/use-now';
import { formatUsdc, yearsUntil } from '@/lib/format';
import { AtRiskRegister, type RegisterRow } from './AtRiskRegister';
import { NamespacePanel } from './NamespacePanel';
import { ValueAtRisk, type TierRow } from './ValueAtRisk';

const WINDOW_DAYS = 28;
const EMPTY_NAMES: readonly SubgraphName[] = [];
const ONE_YEAR = SECONDS_PER_YEAR;

// The scoreboard: one sentence with the live count, then the register of names at risk,
// worst first. Bands are computed here at read time, never stored.
export function ScoreboardPage() {
  const now = useNow();
  const atRisk = useNamesAtRisk(WINDOW_DAYS);
  const namespace = useNamespace();
  const names = atRisk.data?.names ?? EMPTY_NAMES;

  const endowedLabels = useMemo(
    () => names.filter(n => (n.endowment?.shares ?? 0n) > 0n).map(n => n.label),
    [names],
  );
  const { runways } = useVaultRunways(endowedLabels);

  const rows = useMemo<readonly RegisterRow[]>(() => {
    const severity = (band: RiskBand) =>
      ['lapsed', 'grace', 'critical', 'urgent', 'watch', 'safe', 'endowed'].indexOf(band);
    return names
      .map(name => {
        const endowed = (name.endowment?.shares ?? 0n) > 0n;
        const runway = runways.get(name.label);
        const runwayLowYears = runway ? yearsUntil(now, runway.fundedUntilLow) : 0;
        const l = liveness({ expiry: name.expiry, now, endowed, runwayLowYears });
        return {
          name,
          endowed,
          assets: runway?.assets ?? null,
          band: l.band,
          daysToExpiry: l.daysToExpiry,
          deadline: l.deadline,
          yearlyCost: tierRenewPrice(name.tier as Tier, ONE_YEAR),
        };
      })
      .sort(
        (a, b) =>
          severity(a.band) - severity(b.band) ||
          Number(b.yearlyCost - a.yearlyCost) ||
          Number(a.name.expiry - b.name.expiry),
      );
  }, [names, runways, now]);

  const totals = useMemo(() => {
    let grace = 0;
    let unfunded = 0;
    let valueAtRisk = 0n;
    const byTier = new Map<number, TierRow>();
    for (const r of rows) {
      if (r.band === 'grace') grace += 1;
      if (r.band !== 'endowed') {
        unfunded += 1;
        valueAtRisk += r.yearlyCost;
        const t = byTier.get(r.name.tier) ?? { tier: r.name.tier, names: 0, yearly: 0n };
        byTier.set(r.name.tier, { ...t, names: t.names + 1, yearly: t.yearly + r.yearlyCost });
      }
    }
    const tiers = [...byTier.values()].sort((a, b) => a.tier - b.tier);
    return { grace, unfunded, valueAtRisk, tiers };
  }, [rows]);

  const ns = namespace.data?.namespace ?? null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <section className="mb-12 max-w-3xl">
        <h1 className="text-5xl md:text-6xl">
          {atRisk.isLoading ? (
            <span className="motion-safe:animate-pulse-soft text-muted">Counting the names…</span>
          ) : atRisk.error ? (
            <span>The index is unreachable.</span>
          ) : (
            <>
              <span className="text-oxide">{rows.length}</span>{' '}
              {rows.length === 1 ? 'name dies' : 'names die'} this month.
            </>
          )}
        </h1>
        <p className="mt-5 font-title text-xl leading-relaxed text-muted">
          {atRisk.error ? (
            atRisk.error.message
          ) : atRisk.isLoading ? (
            'Reading the ENSv2 registry on Sepolia.'
          ) : (
            <>
              {totals.grace} {totals.grace === 1 ? 'is' : 'are'} already in the 28-day grace period.{' '}
              {totals.unfunded} have no endowment, so {formatUsdc(totals.valueAtRisk)} USDC of
              yearly renewals has nobody to pay it.
              {ns ? (
                <>
                  {' '}
                  Across the namespace, {ns.endowedNames} of {ns.activeNames.toLocaleString()} live
                  names are endowed.
                </>
              ) : null}
            </>
          )}
        </p>
      </section>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <AtRiskRegister rows={rows} isLoading={atRisk.isLoading} windowDays={WINDOW_DAYS} />
        <aside className="flex flex-col gap-10">
          <ValueAtRisk tiers={totals.tiers} />
          <NamespacePanel
            namespace={ns}
            meta={namespace.data?.meta ?? null}
            isLoading={namespace.isLoading}
          />
        </aside>
      </div>
    </main>
  );
}
