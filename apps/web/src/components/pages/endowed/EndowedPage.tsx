'use client';

import { useMemo } from 'react';
import { NameLink } from '@/components/NameLink';
import { Spinner } from '@/components/ui';
import { type RecordTarget, useSpirithFundedUntilMany } from '@/hooks/chain/use-resolver';
import { useVaultRunways } from '@/hooks/chain/use-vault';
import { useEndowments } from '@/hooks/queries/use-endowments';
import { useNamespace } from '@/hooks/queries/use-namespace';
import { formatDate, formatUsdc, fundedRange } from '@/lib/format';

const EMPTY: readonly string[] = [];
const NO_TARGETS: readonly RecordTarget[] = [];

// The names with a standing order. Principal and patrons from the subgraph; the live earmark
// and its funded-until range from the vault, one multicall for the whole list.
export function EndowedPage() {
  const q = useEndowments();
  const namespace = useNamespace();
  const rows = q.data?.endowments ?? [];
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
            ? `${formatUsdc(ns.endowedVolume)} USDC deposited in all, ${formatUsdc(ns.renewalSpend)} USDC already paid to the registrar by the vault, ${formatUsdc(ns.tipsPaid)} USDC of it to whoever pressed the button.`
            : 'Each deposit is earmarked for one name and can leave only as that name’s renewal or back to its patron.'}
        </p>
      </section>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Expires</th>
              <th className="num">Holds</th>
              <th>Funded</th>
              <th className="num">Patrons</th>
              <th className="num">Renewals</th>
              <th>Record</th>
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
                      {runway ? `${formatUsdc(runway.assets)} USDC` : <Spinner />}
                    </td>
                    <td className="whitespace-nowrap text-verdigris">
                      {runway ? range ? range.text : 'not enough for a year' : <Spinner />}
                    </td>
                    <td className="num">{e.patronCount}</td>
                    <td className="num">{e.renewals}</td>
                    <td
                      className={fundedUntil.get(e.label) != null ? 'text-verdigris' : 'text-muted'}
                    >
                      {recordsLoading ? (
                        <Spinner />
                      ) : fundedUntil.get(e.label) != null ? (
                        `published, until ${formatDate(fundedUntil.get(e.label) as bigint)}`
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
