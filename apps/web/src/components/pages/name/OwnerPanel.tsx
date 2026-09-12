'use client';

import { useCallback } from 'react';
import type { Address } from 'viem';
import { Button, Panel } from '@/components/ui';
import { usePrepareNameFlow } from '@/hooks/chain/use-prepare-name-flow';
import type { SpirithRecords } from '@/hooks/chain/use-resolver';

interface Props {
  label: string;
  resolver: Address | undefined;
  records: SpirithRecords | undefined;
  recordWritten: boolean | null;
  /** The vault holds the setter role for both records; null when the resolver cannot say. */
  authorised: boolean | null;
}

// Shown only to the connected owner. The one optional owner action: let the vault publish
// the funding status as text records. Renewals never depend on it.
export function OwnerPanel({ label, records, recordWritten, authorised }: Props) {
  const prepare = usePrepareNameFlow(label);
  const onPrepare = useCallback(() => prepare.mutate(), [prepare]);
  const published = records?.fundedUntil !== null && records?.fundedUntil !== undefined;
  return (
    <Panel title="You own this name">
      {published ? (
        <p className="text-verdigris">
          Spirith is publishing this name's funding status on its resolver. Any wallet or
          marketplace can read it without asking us.
        </p>
      ) : authorised ? (
        <p className="text-verdigris">
          Spirith is authorised to write this name's funding status. The two records appear on the
          resolver at the next deposit, withdrawal or renewal; nothing else is needed from you.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <p>
            Let Spirith write two text records on the name, <code>spirith.funded-until</code> and{' '}
            <code>spirith.patrons</code>, so the name advertises its own funding.
            {recordWritten === false
              ? ' The last write was refused because the vault is not authorised yet.'
              : ''}{' '}
            If the name still uses the shared public resolver, this first gives it a resolver of its
            own; up to four transactions.
          </p>
          <div>
            <Button variant="secondary" onClick={onPrepare} loading={prepare.isPending}>
              Let Spirith publish the record
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
