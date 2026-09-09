import { memo } from 'react';
import type { RiskBand, SubgraphName } from '@spirith/core';
import Link from 'next/link';
import { NameLink } from '@/components/NameLink';
import { LiveIcon } from '@/icons';
import { BandMark, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate, formatDays, formatDollars } from '@/lib/format';

export interface RegisterRow {
  readonly name: SubgraphName;
  readonly endowed: boolean;
  /** Live earmark from the vault; null while loading or when unendowed. */
  readonly assets: bigint | null;
  /** The block the vault would buy now; 0n when the earmark cannot pay a year; null unknown. */
  readonly duration: bigint | null;
  readonly band: RiskBand;
  readonly daysToExpiry: number;
  readonly deadline: bigint;
  readonly yearlyCost: bigint;
}

interface Props {
  rows: readonly RegisterRow[];
  isLoading: boolean;
  windowDays: number;
  now: bigint;
}

// The register: every name inside the window, ruled not boxed, soonest death first. The
// "dies in" column is the memorable thing, so it carries the band's colour and nothing else does.
export function AtRiskRegister({ rows, isLoading, windowDays, now }: Props) {
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
              <th className="num">Dies in</th>
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
              rows.map(row => <Row key={row.name.id} row={row} now={now} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const Row = memo(function Row({ row, now }: { row: RegisterRow; now: bigint }) {
  const dying = row.band === 'grace' || row.band === 'critical';
  return (
    <tr>
      <td>
        <NameLink label={row.name.label} />
      </td>
      <td>
        {row.duration !== null && row.duration > 0n ? (
          // Inside the 28-day window every name is inside the vault's lead window, so an
          // earmark that pays for a year makes the status the action: anyone may renew now,
          // in grace or not. The "dies in" column keeps the clock.
          <Link
            href={`/name/${encodeURIComponent(row.name.label)}`}
            className="inline-flex items-center gap-1.5 text-sm text-verdigris"
          >
            <LiveIcon size="xs" variant="solid" />
            Renew now
          </Link>
        ) : (
          <BandMark band={row.band} />
        )}
      </td>
      <td className="whitespace-nowrap">{formatDate(row.name.expiry)}</td>
      <td className={cn('num whitespace-nowrap', dying && 'text-oxide')}>
        {formatDays(Number((row.deadline - now) / 86_400n))}
      </td>
      <td className="num whitespace-nowrap">{formatDollars(row.yearlyCost)}</td>
      <td className="num whitespace-nowrap">
        {row.endowed ? (
          row.assets === null ? (
            <Spinner />
          ) : (
            <span className="text-verdigris">{formatDollars(row.assets)}</span>
          )
        ) : (
          <span className="text-muted">none</span>
        )}
      </td>
    </tr>
  );
});
