import type { SubgraphMeta, SubgraphNamespace } from '@spirith/core';
import { Spinner } from '@/components/ui';
import { formatUsdc } from '@/lib/format';

interface Props {
  namespace: SubgraphNamespace | null;
  meta: SubgraphMeta | null;
  isLoading: boolean;
}

// Running totals from the subgraph's one Namespace row.
export function NamespacePanel({ namespace, meta, isLoading }: Props) {
  const ratio =
    namespace && namespace.activeNames > 0
      ? (namespace.endowedNames / namespace.activeNames) * 100
      : 0;
  return (
    <section>
      <h2 className="mb-4">The namespace</h2>
      {isLoading ? (
        <Spinner />
      ) : namespace === null ? (
        <p className="text-sm text-muted">No totals yet.</p>
      ) : (
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">Names indexed</dt>
          <dd className="text-right">{namespace.names.toLocaleString()}</dd>
          <dt className="text-muted">Registered now</dt>
          <dd className="text-right">{namespace.activeNames.toLocaleString()}</dd>
          <dt className="text-muted">Endowed</dt>
          <dd className="text-right">
            {namespace.endowedNames} <span className="text-muted">({ratio.toFixed(3)}%)</span>
          </dd>
          <dt className="text-muted">Renewals, all payers</dt>
          <dd className="text-right">{namespace.renewals.toLocaleString()}</dd>
          <dt className="text-muted">Renewals paid by Spirith</dt>
          <dd className="text-right text-verdigris">{namespace.spirithRenewals}</dd>
          <dt className="text-muted">Endowed, total</dt>
          <dd className="text-right">{formatUsdc(namespace.endowedVolume)} USDC</dd>
          <dt className="text-muted">Spent on renewals</dt>
          <dd className="text-right">{formatUsdc(namespace.renewalSpend)} USDC</dd>
          <dt className="text-muted">Keeper tips</dt>
          <dd className="text-right">{formatUsdc(namespace.tipsPaid)} USDC</dd>
        </dl>
      )}
      {meta ? (
        <p className="mt-4 text-xs text-muted">
          Index at block {meta.block.toLocaleString()}
          {meta.hasIndexingErrors ? ', with indexing errors' : ''}.
        </p>
      ) : null}
    </section>
  );
}
