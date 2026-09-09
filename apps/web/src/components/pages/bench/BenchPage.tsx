'use client';

import { useCallback, useState } from 'react';
import { AddressLink } from '@/components/AddressLink';
import { Button, Field, Panel, Spinner } from '@/components/ui';
import { REGISTRAR, REGISTRY, USDC, VAULT } from '@/hooks/chain/contracts';
import { useChainMutation } from '@/hooks/chain/use-chain-mutation';
import { useNameExpiry, useNameOwner, useNameResolver } from '@/hooks/chain/use-registry';
import { useIsRenewable, useRenewPrice } from '@/hooks/chain/use-registrar';
import { useUsdcAllowance, useUsdcBalance } from '@/hooks/chain/use-usdc';
import { useVaultConstants, useVaultRunway } from '@/hooks/chain/use-vault';
import { useWallet } from '@/hooks/chain/use-wallet';
import { APP_CHAIN } from '@/lib/chain';
import { formatDate, formatDuration, formatRate, formatUsdc } from '@/lib/format';
import { SECONDS_PER_YEAR } from '@spirith/core';

const TEN_USDC = 10_000_000n;

// Unlinked contract bench (`web3-chain-layer` § Testing): one section per contract, every
// read's live value, a button per write. Writes are real Sepolia transactions.
export function BenchPage() {
  const wallet = useWallet();
  const [label, setLabel] = useState('spirithbeta');
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-12">
      <h1>Bench</h1>
      <p className="text-muted">
        {APP_CHAIN.chain.name}, chain {APP_CHAIN.chainId}.{' '}
        {wallet.address ? (
          <>
            Connected as <AddressLink address={wallet.address} />.
          </>
        ) : (
          'Not connected.'
        )}
      </p>
      <Field label="Label" value={label} onChange={e => setLabel(e.target.value.trim())} />
      <VaultBench label={label} />
      <UsdcBench />
      <RegistryBench label={label} />
      <RegistrarBench label={label} />
    </main>
  );
}

function VaultBench({ label }: { label: string }) {
  const { constants } = useVaultConstants();
  const { runway, error } = useVaultRunway(label);
  return (
    <Panel title="SpirithVault" aside={<AddressLink address={VAULT.address} />}>
      <dl className="grid grid-cols-[12rem_1fr] gap-y-1 text-sm">
        <dt className="text-muted">DEPOSIT_CAP</dt>
        <dd>{constants ? `${formatUsdc(constants.depositCap)} USDC` : <Spinner />}</dd>
        <dt className="text-muted">RESERVE_YEARS</dt>
        <dd>{constants ? String(constants.reserveYears) : <Spinner />}</dd>
        <dt className="text-muted">RENEW_LEAD</dt>
        <dd>{constants ? formatDuration(constants.renewLead) : <Spinner />}</dd>
        <dt className="text-muted">NOTICE_PERIOD</dt>
        <dd>{constants ? formatDuration(constants.noticePeriod) : <Spinner />}</dd>
        <dt className="text-muted">tip</dt>
        <dd>
          {constants ? (
            `${Number(constants.tipBps) / 100}% capped at ${formatUsdc(constants.tipCap)} USDC`
          ) : (
            <Spinner />
          )}
        </dd>
        <dt className="text-muted">adapter rate</dt>
        <dd>{constants ? formatRate(constants.rateLowBps, constants.rateHighBps) : <Spinner />}</dd>
        <dt className="text-muted">runwayOf(label)</dt>
        <dd>
          {error ? (
            <span className="text-oxide">{error.message}</span>
          ) : runway ? (
            `${formatUsdc(runway.assets)} USDC, ${formatDate(runway.fundedUntilLow)} to ${formatDate(runway.fundedUntilHigh)}, next block ${runway.duration === 0n ? 'none' : formatDuration(runway.duration)}`
          ) : (
            <Spinner />
          )}
        </dd>
      </dl>
    </Panel>
  );
}

function UsdcBench() {
  const wallet = useWallet();
  const { balance } = useUsdcBalance(wallet.address);
  const { allowance } = useUsdcAllowance(wallet.address);
  const mint = useChainMutation<void, void>('MockUSDC::mint()', async tx => {
    await tx.send('MockUSDC::mint()', {
      ...USDC,
      functionName: 'mint',
      args: [tx.account, TEN_USDC],
    });
  });
  const approve = useChainMutation<void, void>('MockUSDC::approve()', async tx => {
    await tx.send('MockUSDC::approve()', {
      ...USDC,
      functionName: 'approve',
      args: [VAULT.address, TEN_USDC],
    });
  });
  const onMint = useCallback(() => mint.mutate(), [mint]);
  const onApprove = useCallback(() => approve.mutate(), [approve]);
  return (
    <Panel title="MockUSDC" aside={<AddressLink address={USDC.address} />}>
      <dl className="grid grid-cols-[12rem_1fr] gap-y-1 text-sm">
        <dt className="text-muted">balanceOf(you)</dt>
        <dd>{balance === undefined ? '—' : `${formatUsdc(balance)} USDC`}</dd>
        <dt className="text-muted">allowance(you, vault)</dt>
        <dd>{allowance === undefined ? '—' : `${formatUsdc(allowance)} USDC`}</dd>
      </dl>
      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={onMint}
          disabled={!wallet.isConnected}
          loading={mint.isPending}
        >
          mint 10 USDC
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onApprove}
          disabled={!wallet.isConnected}
          loading={approve.isPending}
        >
          approve vault for 10 USDC
        </Button>
      </div>
    </Panel>
  );
}

function RegistryBench({ label }: { label: string }) {
  const { expiry } = useNameExpiry(label);
  const { owner } = useNameOwner(label);
  const { resolver } = useNameResolver(label);
  return (
    <Panel title="ETHRegistry" aside={<AddressLink address={REGISTRY.address} />}>
      <dl className="grid grid-cols-[12rem_1fr] gap-y-1 text-sm">
        <dt className="text-muted">findExpiry</dt>
        <dd>
          {expiry === undefined ? (
            <Spinner />
          ) : expiry === 0n ? (
            'not registered'
          ) : (
            formatDate(expiry)
          )}
        </dd>
        <dt className="text-muted">findOwner</dt>
        <dd>{owner === undefined ? <Spinner /> : <AddressLink address={owner} />}</dd>
        <dt className="text-muted">getResolver</dt>
        <dd>{resolver === undefined ? <Spinner /> : <AddressLink address={resolver} />}</dd>
      </dl>
    </Panel>
  );
}

const DURATIONS = [1n, 2n, 3n, 6n] as const;

function RegistrarBench({ label }: { label: string }) {
  const { isRenewable } = useIsRenewable(label);
  return (
    <Panel title="ETHRegistrar" aside={<AddressLink address={REGISTRAR.address} />}>
      <dl className="grid grid-cols-[12rem_1fr] gap-y-1 text-sm">
        <dt className="text-muted">isRenewable</dt>
        <dd>{isRenewable === undefined ? <Spinner /> : String(isRenewable)}</dd>
        {DURATIONS.map(years => (
          <PriceRow key={String(years)} label={label} years={years} />
        ))}
      </dl>
    </Panel>
  );
}

function PriceRow({ label, years }: { label: string; years: bigint }) {
  const { price } = useRenewPrice(label, years * SECONDS_PER_YEAR);
  return (
    <>
      <dt className="text-muted">getRenewPrice({String(years)}y)</dt>
      <dd>{price === undefined ? <Spinner /> : `${formatUsdc(price)} USDC`}</dd>
    </>
  );
}
