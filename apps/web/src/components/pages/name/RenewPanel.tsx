'use client';

import { useCallback } from 'react';
import { Button, Panel, Spinner } from '@/components/ui';
import { useRenewFlow } from '@/hooks/chain/use-renew-flow';
import { useRenewPrice } from '@/hooks/chain/use-registrar';
import { type VaultConstants, type VaultRunway, tipFor } from '@/hooks/chain/use-vault';
import type { Wallet } from '@/hooks/chain/use-wallet';
import { formatDate, formatDuration, formatUsdc } from '@/lib/format';

interface Props {
  label: string;
  now: bigint;
  expiry: bigint | undefined;
  runway: VaultRunway | undefined;
  constants: VaultConstants | undefined;
  renewable: boolean | undefined;
  wallet: Wallet;
}

// Permissionless renewal. The button is for anyone, owner or stranger, and shows what the
// vault will pay and what the caller takes home. It appears only when the vault's own
// trigger holds: inside the lead window (or grace), with an earmark that affords a year.
export function RenewPanel({ label, now, expiry, runway, constants, renewable, wallet }: Props) {
  const duration = runway?.duration;
  const { price } = useRenewPrice(label, duration);
  const renew = useRenewFlow(label);
  const onRenew = useCallback(() => {
    if (!wallet.isConnected) {
      wallet.connect();
      return;
    }
    renew.mutate();
  }, [wallet, renew]);

  if (
    expiry === undefined ||
    runway === undefined ||
    constants === undefined ||
    renewable === undefined
  ) {
    return (
      <Panel title="Renew">
        <Spinner />
      </Panel>
    );
  }
  const dueAt = expiry - constants.renewLead;
  const due = now >= dueAt;
  const funded = runway.duration > 0n;
  const tip = price !== undefined ? tipFor(price, constants) : undefined;

  return (
    <Panel title="Renew">
      {!renewable ? (
        <p className="text-muted">The registrar no longer accepts a renewal for this name.</p>
      ) : !funded ? (
        <p className="text-muted">
          The earmark cannot pay for one year yet, so there is nothing for a keeper to do.
        </p>
      ) : !due ? (
        <p className="text-muted">
          Renewal opens on {formatDate(dueAt)}, {formatDuration(constants.renewLead)} before expiry.
          There is no early-renew path: prepaying years ahead would only stop the deposit earning.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <p>
            Anyone may press this. The vault pays the registrar{' '}
            {price !== undefined ? `${formatUsdc(price)} USDC` : '…'} for{' '}
            {formatDuration(runway.duration)} from this name's own earmark, and tips the caller{' '}
            {tip !== undefined ? `${formatUsdc(tip)} USDC` : '…'}.
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={onRenew} loading={renew.isPending} size="lg">
              {wallet.isConnected
                ? `Renew now for ${formatDuration(runway.duration)}`
                : 'Connect to renew'}
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
