import type { SubgraphRenewal } from '@spirith/core';
import { AddressLink, TxLink } from '@/components/AddressLink';
import { Spinner } from '@/components/ui';
import { formatDate, formatDuration, formatUsdc } from '@/lib/format';

interface Props {
  renewals: readonly SubgraphRenewal[];
  isLoading: boolean;
}

// Every renewal the registrar recorded, by anyone; the ones Spirith paid say who pressed
// the button and what they took home.
export function RenewalHistory({ renewals, isLoading }: Props) {
  // The facts list already says "Never renewed"; an empty table would only repeat it.
  if (!isLoading && renewals.length === 0) return null;
  return (
    <section>
      <h2 className="mb-4">Renewals</h2>
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th>When</th>
                <th>For</th>
                <th>New expiry</th>
                <th className="num">Paid</th>
                <th>Payer</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {renewals.map(r => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{formatDate(r.timestamp)}</td>
                  <td className="whitespace-nowrap">{formatDuration(r.duration)}</td>
                  <td className="whitespace-nowrap">{formatDate(r.newExpiry)}</td>
                  <td className="num whitespace-nowrap">{formatUsdc(r.amount)}</td>
                  <td>
                    {r.viaSpirith ? (
                      <span className="text-verdigris">
                        Spirith
                        {r.keeper ? (
                          <>
                            , pressed by <AddressLink address={r.keeper} className="text-sm" />
                            {r.tip !== null && r.tip > 0n ? ` for ${formatUsdc(r.tip)}` : ''}
                          </>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-muted">someone else</span>
                    )}
                  </td>
                  <td>
                    <TxLink hash={r.txHash} className="text-sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
