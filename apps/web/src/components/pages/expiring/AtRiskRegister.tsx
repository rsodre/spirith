import { memo } from 'react';
import type { RiskBand, SubgraphName } from '@spirith/core';
import { NameLink } from '@/components/NameLink';
import { BandMark, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate, formatDays, formatUsdc } from '@/lib/format';

export interface RegisterRow {
  readonly name: SubgraphName;
  readonly endowed: boolean;
  /** Live earmark from the vault; null while loading or when unendowed. */
  readonly assets: bigint | null;
  readonly band: RiskBand;
  readonly daysToExpiry: number;
  readonly deadline: bigint;
  readonly yearlyCost: bigint;
}

interface Props {
  rows: readonly RegisterRow[];
  isLoading: boolean;
  windowDays: number;
}

// The register: every name inside the window, ruled not boxed, worst first. The "left"
// column is the memorable thing, so it carries the band's colour and nothing else does.
export function AtRiskRegister({ rows, isLoading, windowDays }: Props) {
  return (
    <section>
      <h2 className="mb-4">Expiring within {windowDays} days</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Expires</th>
              <th className="num">Left</th>
              <th className="num">Price / year</th>
              <th className="num">Endowment</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center">
                  <Spinner />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-muted">
                  Nothing expires in this window. Come back nearer the end of the month.
                </td>
              </tr>
            ) : (
              rows.map(row => <Row key={row.name.id} row={row} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const Row = memo(function Row({ row }: { row: RegisterRow }) {
  const dying = row.band === 'grace' || row.band === 'critical';
  return (
    <tr>
      <td>
        <NameLink label={row.name.label} />
      </td>
      <td>
        <BandMark band={row.band} />
      </td>
      <td className="whitespace-nowrap">{formatDate(row.name.expiry)}</td>
      <td className={cn('num whitespace-nowrap', dying && 'text-oxide')}>
        {row.daysToExpiry < 0
          ? `grace, ${formatDays(Number((row.deadline - row.name.expiry) / 86_400n) + row.daysToExpiry)}`
          : formatDays(row.daysToExpiry)}
      </td>
      <td className="num whitespace-nowrap">{formatUsdc(row.yearlyCost)}</td>
      <td className="num whitespace-nowrap">
        {row.endowed ? (
          row.assets === null ? (
            <Spinner />
          ) : (
            <span className="text-verdigris">{formatUsdc(row.assets)} USDC</span>
          )
        ) : (
          <span className="text-muted">none</span>
        )}
      </td>
    </tr>
  );
});
