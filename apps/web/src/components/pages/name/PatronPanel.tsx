'use client';

import { useCallback } from 'react';
import { Button, Panel } from '@/components/ui';
import { type VaultConstants, usePatronPosition } from '@/hooks/chain/use-vault';
import type { Wallet } from '@/hooks/chain/use-wallet';
import { useExecuteWithdrawFlow, useRequestWithdrawFlow } from '@/hooks/chain/use-withdraw-flow';
import { formatDate, formatDuration, formatUsdc } from '@/lib/format';

interface Props {
  label: string;
  now: bigint;
  constants: VaultConstants | undefined;
  wallet: Wallet;
}

// The connected patron's own claim and its only exit: a notice, then a withdrawal. Delayed,
// never blocked; the panel is absent for anyone without a claim.
export function PatronPanel({ label, now, constants, wallet }: Props) {
  const { position } = usePatronPosition(label, wallet.address);
  const request = useRequestWithdrawFlow(label);
  const execute = useExecuteWithdrawFlow(label);
  const onRequest = useCallback(() => {
    if (position) request.mutate({ shares: position.shares });
  }, [position, request]);
  const onExecute = useCallback(() => execute.mutate(), [execute]);

  if (!position || position.shares === 0n || !constants) return null;
  const executableAt = position.noticeAt + constants.noticePeriod;
  const noticePending = position.noticeShares > 0n;
  const ready = noticePending && now >= executableAt;

  return (
    <Panel title="Your claim">
      <p className="mb-4">
        Your share of this earmark is worth {formatUsdc(position.assets)} USDC at the current share
        price.
      </p>
      {!noticePending ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Withdrawing takes {formatDuration(constants.noticePeriod)} of notice, so that "funded
            until" stays a true statement while the money is spoken for.
          </p>
          <div>
            <Button variant="danger" size="sm" onClick={onRequest} loading={request.isPending}>
              Give notice on my whole claim
            </Button>
          </div>
        </div>
      ) : ready ? (
        <div>
          <Button variant="danger" onClick={onExecute} loading={execute.isPending}>
            Withdraw now
          </Button>
        </div>
      ) : (
        <p className="text-sm text-amber">
          Notice given. You can withdraw from {formatDate(executableAt)}.
        </p>
      )}
    </Panel>
  );
}
