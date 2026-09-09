'use client';

import { useMemo } from 'react';
import { GRACE_PERIOD_SECONDS } from '@spirith/core';
import Link from 'next/link';
import { ExternalLink } from '@/components/ExternalLink';
import { NameLink } from '@/components/NameLink';
import { Spinner } from '@/components/ui';
import { type RecordTarget, useSpirithFundedUntilMany } from '@/hooks/chain/use-resolver';
import { type VaultRunway, useVaultConstants, useVaultRunways } from '@/hooks/chain/use-vault';
import { useNow } from '@/hooks/use-now';
import { WarningIcon } from '@/icons';
import { useEndowments } from '@/hooks/queries/use-endowments';
import { useNamespace } from '@/hooks/queries/use-namespace';
import { ensExplorerName } from '@/lib/chain';
import { formatDate, formatDays, formatDollars, fundedRange } from '@/lib/format';

const EMPTY: readonly string[] = [];
const NO_TARGETS: readonly RecordTarget[] = [];

const DAY = 86_400n;

// The names with a standing order, nearest expiry first. Principal and patrons from the
// subgraph; the live earmark and its funded-until range from the vault, one multicall for the
// whole list; the renewal column from the vault's own trigger (lead window, or grace).
export function EndowedPage() {
  const now = useNow();
  const q = useEndowments();
  const namespace = useNamespace();
  const { constants } = useVaultConstants();
  const rows = useMemo(
    () =>
      q.data ? [...q.data.endowments].sort((a, b) => Number(a.name.expiry - b.name.expiry)) : [],
    [q.data],
  );
  const labels = useMemo(() => (q.data ? q.data.endowments.map(e => e.label) : EMPTY), [q.data]);
  const { runways } = useVaultRunways(labels);
  // The record itself, from each name's resolver: the subgraph only learns of a write from
  // `Renewed`, so a fresh endowment's record is invisible to it.
  const targets = useMemo<readonly RecordTarget[]>(
    () =>
      q.data
        ? q.data.endowments.map(e => ({ label: e.label, resolver: e.name.resolver }))
        : NO_TARGETS,
    [q.data],
  );
  const { fundedUntil, isLoading: recordsLoading } = useSpirithFundedUntilMany(targets);
  const ns = namespace.data?.namespace ?? null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <section className="mb-10 max-w-3xl">
        <h1 className="text-5xl md:text-6xl">
          {q.isLoading ? (
            <span className="motion-safe:animate-pulse-soft text-muted">Reading the ledger…</span>
          ) : (
            <>
              <span className="text-verdigris">{rows.length}</span>{' '}
              {rows.length === 1 ? 'name is' : 'names are'} endowed.
            </>
          )}
        </h1>
        <p className="mt-5 font-title text-xl leading-relaxed text-muted">
          {ns
            ? `${formatDollars(ns.endowedVolume)} deposited in all, ${formatDollars(ns.renewalSpend)} already paid to the registrar by the vault, ${formatDollars(ns.tipsPaid)} of it to whoever pressed the button.`
            : 'Each deposit is earmarked for one name and can leave only as that name’s renewal or back to its patron.'}
        </p>
      </section>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Expires</th>
              <th className="num">Endowment</th>
              <th>Funded</th>
              <th className="num">Patrons</th>
              <th>Renewal</th>
              <th>ENSv2 record</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center">
                  <Spinner />
                </td>
              </tr>
            ) : q.error ? (
              <tr>
                <td colSpan={7} className="py-8 text-oxide">
                  {q.error.message}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-muted">
                  No name is endowed yet. Pick one from the expiring list.
                </td>
              </tr>
            ) : (
              rows.map(e => {
                const runway = runways.get(e.label);
                const range =
                  runway && runway.assets > 0n
                    ? fundedRange(runway.fundedUntilLow, runway.fundedUntilHigh, e.name.expiry)
                    : undefined;
                return (
                  <tr key={e.id}>
                    <td>
                      <NameLink label={e.label} />
                    </td>
                    <td className="whitespace-nowrap">{formatDate(e.name.expiry)}</td>
                    <td className="num whitespace-nowrap">
                      {runway ? formatDollars(runway.assets) : <Spinner />}
                    </td>
                    <td className="whitespace-nowrap text-verdigris">
                      {runway ? range ? range.text : 'not enough for a year' : <Spinner />}
                    </td>
                    <td className="num">{e.patronCount}</td>
                    <td className="whitespace-nowrap">
                      {runway && constants ? (
                        <RenewalCell
                          label={e.label}
                          expiry={e.name.expiry}
                          runway={runway}
                          renewLead={constants.renewLead}
                          now={now}
                        />
                      ) : (
                        <Spinner />
                      )}
                    </td>
                    <td
                      className={fundedUntil.get(e.label) != null ? 'text-verdigris' : 'text-muted'}
                    >
                      {recordsLoading ? (
                        <Spinner />
                      ) : fundedUntil.get(e.label) != null ? (
                        <ExternalLink href={ensExplorerName(e.label)} className="text-verdigris">
                          published, until {formatDate(fundedUntil.get(e.label) as bigint)}
                        </ExternalLink>
                      ) : (
                        'not published'
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

interface RenewalCellProps {
  label: string;
  expiry: bigint;
  runway: VaultRunway;
  renewLead: bigint;
  now: bigint;
}

// The same clock the name card's Renew panel shows: in oxide once anyone may press renew.
function RenewalCell({ label, expiry, runway, renewLead, now }: RenewalCellProps) {
  const deadline = expiry + GRACE_PERIOD_SECONDS;
  const dueAt = expiry - renewLead;
  if (now >= deadline) return <span className="text-muted">lapsed</span>;
  if (runway.duration === 0n) return <span className="text-amber">underfunded</span>;
  if (now >= dueAt) {
    return (
      <Link
        href={`/name/${encodeURIComponent(label)}`}
        className="inline-flex items-center gap-1.5 text-oxide"
      >
        <WarningIcon size="sm" />
        {now >= expiry ? 'in grace, renew now' : 'renew now'}, dies in{' '}
        {formatDays(Number((deadline - now) / DAY))}
      </Link>
    );
  }
  return <span className="text-muted">renew in {formatDays(Number((dueAt - now) / DAY))}</span>;
}
