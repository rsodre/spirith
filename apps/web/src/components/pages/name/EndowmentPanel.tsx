'use client';

import { type FormEvent, useCallback, useMemo, useState } from 'react';
import { type SubgraphEndowment, tierOf } from '@spirith/core';
import { AddressLink } from '@/components/AddressLink';
import { Button, Field, Panel, Spinner } from '@/components/ui';
import { useEndowFlow } from '@/hooks/chain/use-endow-flow';
import type { VaultConstants, VaultRunway } from '@/hooks/chain/use-vault';
import type { Wallet } from '@/hooks/chain/use-wallet';
import { formatDuration, formatRate, formatUsdc, fundedRange, parseUsdc } from '@/lib/format';
import { projectFunding } from '@/lib/projection';

interface Props {
  label: string;
  expiry: bigint | undefined;
  runway: VaultRunway | undefined;
  constants: VaultConstants | undefined;
  endowment: SubgraphEndowment | null;
  renewable: boolean | undefined;
  wallet: Wallet;
}

// The endowment: what the earmark holds, how long it lasts as a range (honest UI rule), and
// the form that grows it. Endowing is the one accent action on this page.
export function EndowmentPanel({
  label,
  expiry,
  runway,
  constants,
  endowment,
  renewable,
  wallet,
}: Props) {
  const endowed = (runway?.assets ?? 0n) > 0n;
  const range = useMemo(
    () =>
      runway && expiry !== undefined && endowed
        ? fundedRange(runway.fundedUntilLow, runway.fundedUntilHigh, expiry)
        : undefined,
    [runway, expiry, endowed],
  );
  const room = constants && runway ? constants.depositCap - runway.assets : undefined;

  return (
    <Panel
      title="Endowment"
      aside={
        constants
          ? `yield ${formatRate(constants.rateLowBps, constants.rateHighBps)}, simulated`
          : null
      }
    >
      {runway === undefined ? (
        <Spinner />
      ) : !endowed ? (
        <p className="text-muted">
          Nothing is earmarked for this name. Anyone can change that: the deposit stays this name's
          own, and only ever leaves as a renewal payment or back to whoever put it in.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="font-title text-3xl leading-tight">
            {formatUsdc(runway.assets)} <span className="text-muted">USDC</span>
          </p>
          {range ? (
            <p className="font-title text-2xl leading-snug text-verdigris">funded {range.text}</p>
          ) : null}
          <dl className="grid grid-cols-[10rem_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">Next renewal buys</dt>
            <dd>{runway.duration === 0n ? 'nothing yet' : formatDuration(runway.duration)}</dd>
            {endowment ? (
              <>
                <dt className="text-muted">Contributed</dt>
                <dd>{formatUsdc(endowment.contributed)} USDC</dd>
                <dt className="text-muted">Spent on renewals</dt>
                <dd>
                  {formatUsdc(endowment.spent)} USDC
                  {endowment.tipsPaid > 0n
                    ? `, of which ${formatUsdc(endowment.tipsPaid)} in tips`
                    : ''}
                </dd>
                <dt className="text-muted">Patrons</dt>
                <dd>
                  {endowment.patronCount}
                  <span className="ml-2 inline-flex flex-wrap gap-2">
                    {endowment.patronages
                      .filter(p => p.shares > 0n)
                      .map(p => (
                        <AddressLink key={p.patron} address={p.patron} className="text-sm" />
                      ))}
                  </span>
                </dd>
              </>
            ) : null}
          </dl>
        </div>
      )}
      <EndowForm
        label={label}
        room={room}
        renewable={renewable}
        wallet={wallet}
        assets={runway?.assets}
        expiry={expiry}
        constants={constants}
      />
    </Panel>
  );
}

const SUGGESTED = ['25', '50', '100', '150'] as const;

function EndowForm({
  label,
  room,
  renewable,
  wallet,
  assets,
  expiry,
  constants,
}: {
  label: string;
  room: bigint | undefined;
  renewable: boolean | undefined;
  wallet: Wallet;
  assets: bigint | undefined;
  expiry: bigint | undefined;
  constants: VaultConstants | undefined;
}) {
  const [text, setText] = useState('25');
  const [error, setError] = useState<string | undefined>();
  const endow = useEndowFlow(label);

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!wallet.isConnected) {
        wallet.connect();
        return;
      }
      let amount: bigint;
      try {
        amount = parseUsdc(text);
      } catch (err) {
        setError((err as Error).message);
        return;
      }
      if (room !== undefined && amount > room) {
        setError(`The cap leaves room for ${formatUsdc(room)} USDC.`);
        return;
      }
      setError(undefined);
      endow.mutate({ amount });
    },
    [wallet, text, room, endow],
  );

  // What the earmark would cover after this deposit, recomputed as the amount is typed.
  const projection = useMemo(() => {
    if (assets === undefined || expiry === undefined || constants === undefined) return undefined;
    let amount: bigint;
    try {
      amount = parseUsdc(text);
    } catch {
      return undefined;
    }
    if (amount <= 0n) return undefined;
    try {
      return projectFunding({ assets: assets + amount, tier: tierOf(label), expiry, constants });
    } catch {
      return undefined;
    }
  }, [assets, expiry, constants, text, label]);

  const disabled = renewable !== true || (room !== undefined && room <= 0n);
  const hint =
    renewable === undefined
      ? 'Checking the registrar.'
      : !renewable
        ? 'This name cannot be renewed, so it cannot be endowed.'
        : room === undefined
          ? '100 test USDC are minted for you if you are short.'
          : room <= 0n
            ? 'This name is at the testnet cap.'
            : `Room under the cap: ${formatUsdc(room)} USDC. 100 test USDC are minted for you if you are short.`;

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3 border-line border-t pt-5">
      <Field
        label="Endow this name"
        suffix="USDC"
        inputMode="decimal"
        value={text}
        onChange={e => setText(e.target.value)}
        hint={hint}
        error={error}
        disabled={disabled || endow.isPending}
      />
      <div className="flex flex-wrap items-center gap-2">
        {SUGGESTED.map(s => (
          <Button
            key={s}
            variant="ghost"
            size="sm"
            onClick={() => setText(s)}
            disabled={disabled || endow.isPending}
          >
            ${s}
          </Button>
        ))}
        <Button
          type="submit"
          variant="accent"
          className="ml-auto"
          loading={endow.isPending}
          disabled={disabled}
        >
          {wallet.isConnected ? 'Endow' : 'Connect to endow'}
        </Button>
      </div>
      <p className="min-h-6 font-title text-lg">
        {projection ? (
          <>
            After this deposit, <span className="text-verdigris">funded {projection.text}</span>
            {constants ? ` at ${formatRate(constants.rateLowBps, constants.rateHighBps)}` : ''}.
          </>
        ) : assets !== undefined && constants !== undefined && text.trim() !== '' ? (
          <span className="text-muted">Still short of one year of renewal.</span>
        ) : null}
      </p>
      {wallet.wrongChain ? (
        <p className="text-sm text-oxide">Your wallet is on another network; switch to Sepolia.</p>
      ) : null}
    </form>
  );
}
