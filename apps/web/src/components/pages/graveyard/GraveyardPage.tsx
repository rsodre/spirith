'use client';

import { useMemo } from 'react';
import { GRACE_PERIOD_SECONDS, type SubgraphName } from '@spirith/core';
import Link from 'next/link';
import { AddressLink } from '@/components/AddressLink';
import { NameLink } from '@/components/NameLink';
import { Spinner } from '@/components/ui';
import { useVaultRunways } from '@/hooks/chain/use-vault';
import { useGraveyard } from '@/hooks/queries/use-graveyard';
import { useNamesAtRisk } from '@/hooks/queries/use-names-at-risk';
import { useNow } from '@/hooks/use-now';
import { formatDate, formatDays, tierLabel } from '@/lib/format';

const EMPTY: readonly SubgraphName[] = [];

// Names that already lapsed, and one line for the ones in their last 28 days: expired, still
// renewable, one deposit or one button press away from either list.
export function GraveyardPage() {
  const now = useNow();
  const lapsed = useGraveyard();
  const grace = useNamesAtRisk(0);
  const names = lapsed.data?.names ?? EMPTY;
  const dying = grace.data?.names ?? EMPTY;
  const endowedLabels = useMemo(
    () => dying.filter(n => (n.endowment?.shares ?? 0n) > 0n).map(n => n.label),
    [dying],
  );
  const { runways } = useVaultRunways(endowedLabels);
  // Ready means the vault's own trigger holds: in grace, with an earmark that pays a year.
  const ready = useMemo(
    () => endowedLabels.filter(l => (runways.get(l)?.duration ?? 0n) > 0n).length,
    [endowedLabels, runways],
  );
  const needEndowment = dying.length - ready;
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <section className="mb-10 max-w-3xl">
        <h1 className="text-5xl md:text-6xl">
          {lapsed.isLoading ? (
            <span className="motion-safe:animate-pulse-soft text-muted">Reading the register…</span>
          ) : (
            <>
              <span className="text-muted">{names.length}</span>{' '}
              {names.length === 1 ? 'name has' : 'names have'} lapsed
              {names.length >= 200 ? ' at least' : ''}.
            </>
          )}
        </h1>
        <p className="mt-5 font-title text-xl leading-relaxed text-muted">
          Past their 28 days of grace and no longer renewable. Whatever they pointed at is still
          there, still addressed, and no longer reachable by name.
          {!grace.isLoading && dying.length > 0
            ? ` ${dying.length} more ${dying.length === 1 ? 'is' : 'are'} expired and inside the grace period: still renewable, for now.`
            : ''}
        </p>
      </section>

      <Register
        title="Lapsed"
        names={names}
        isLoading={lapsed.isLoading}
        error={lapsed.error}
        empty="Nothing has lapsed yet. The ENSv2 Sepolia registry opened on 30 July 2026 with 28-day minimum registrations, so the first names can lapse from 24 September."
        column="Lost for"
        cell={n => formatDays(Number((now - n.expiry - GRACE_PERIOD_SECONDS) / 86_400n))}
        muted
      />

      <p className="mt-12 font-title text-xl leading-relaxed">
        {grace.isLoading ? (
          <Spinner />
        ) : dying.length === 0 ? (
          <span className="text-muted">No name is in its grace period.</span>
        ) : (
          <Link href="/expiring">
            <span className="text-oxide">{needEndowment}</span>{' '}
            {needEndowment === 1 ? 'name' : 'names'} in the grace period{' '}
            {needEndowment === 1 ? 'needs' : 'need'} an endowment
            {ready > 0 ? (
              <>
                , <span className="text-verdigris">{ready}</span> {ready === 1 ? 'is' : 'are'} ready
                to renew
              </>
            ) : null}
            .
          </Link>
        )}
      </p>
    </main>
  );
}

interface RegisterProps {
  title: string;
  names: readonly SubgraphName[];
  isLoading: boolean;
  error: Error | null;
  empty: string;
  column: string;
  cell: (name: SubgraphName) => string;
  muted?: boolean;
}

function Register({ title, names, isLoading, error, empty, column, cell, muted }: RegisterProps) {
  return (
    <section>
      <h2 className="mb-4">{title}</h2>
      <div className="overflow-x-auto">
        <table className={muted ? 'text-muted' : undefined}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Expired</th>
              <th className="num">{column}</th>
              <th>Tier</th>
              <th>{muted ? 'Last owner' : 'Owner'}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center">
                  <Spinner />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="py-8 text-oxide">
                  {error.message}
                </td>
              </tr>
            ) : names.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-muted">
                  {empty}
                </td>
              </tr>
            ) : (
              names.map(n => (
                <tr key={n.id}>
                  <td>
                    <NameLink label={n.label} className={muted ? 'text-muted' : undefined} />
                  </td>
                  <td className="whitespace-nowrap">{formatDate(n.expiry)}</td>
                  <td className="num whitespace-nowrap">{cell(n)}</td>
                  <td>{tierLabel(n.tier)}</td>
                  <td>
                    <AddressLink address={n.owner} className={muted ? 'text-muted' : undefined} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
