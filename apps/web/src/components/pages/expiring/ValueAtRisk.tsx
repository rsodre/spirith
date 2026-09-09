import { formatUsdc, tierLabel } from '@/lib/format';

export interface TierRow {
  readonly tier: number;
  readonly names: number;
  readonly yearly: bigint;
}

// The contrast the spec asks for (§8): short, expensive names are the ones most likely to die.
export function ValueAtRisk({ tiers }: { tiers: readonly TierRow[] }) {
  return (
    <section>
      <h2 className="mb-4">Unfunded, by tier</h2>
      {tiers.length === 0 ? (
        <p className="text-sm text-muted">Every name in the window is endowed.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tier</th>
              <th className="num">Names</th>
              <th className="num">USDC / year</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map(t => (
              <tr key={t.tier}>
                <td>{tierLabel(t.tier)}</td>
                <td className="num">{t.names}</td>
                <td className="num">{formatUsdc(t.yearly)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
