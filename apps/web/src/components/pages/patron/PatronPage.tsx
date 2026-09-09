'use client';

import { type FormEvent, useCallback, useMemo, useState } from 'react';
import { GRACE_PERIOD_SECONDS, SECONDS_PER_YEAR, type SubgraphName } from '@spirith/core';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink } from '@/components/ExternalLink';
import { NameLink } from '@/components/NameLink';
import { Button, Field, Panel, Spinner } from '@/components/ui';
import { useRegisterFlow } from '@/hooks/chain/use-register-flow';
import { useIsAvailable, useRegisterPrices } from '@/hooks/chain/use-registrar';
import { usePatronAssetsMany, useVaultRunways } from '@/hooks/chain/use-vault';
import { useWallet, type Wallet } from '@/hooks/chain/use-wallet';
import { useOwnedNames } from '@/hooks/queries/use-owned-names';
import { usePatron } from '@/hooks/queries/use-patron';
import { useNow } from '@/hooks/use-now';
import { formatDate, formatDays, formatDollars, formatUsdc, fundedRange } from '@/lib/format';
import { ensManagerName } from '@/lib/links';

const DAY = 86_400n;

/** Only ENSv2's own label rules matter here; the registrar says the rest. */
function normaliseLabel(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\.eth$/, '');
}

// The connected wallet's page: the names it endows, the names it owns, a way to find any
// name, and a way to register a new one straight on the ENSv2 registrar.
export function PatronPage() {
  const wallet = useWallet();
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <section className="mb-10 max-w-3xl">
        <h1 className="text-5xl md:text-6xl">Patron</h1>
        <p className="mt-5 font-title text-xl leading-relaxed text-muted">
          {wallet.isConnected
            ? 'The names you keep alive, the names you own, and the way to add another.'
            : 'Connect a wallet to see the names you endow and the names you own.'}
        </p>
        {!wallet.isConnected ? (
          <div className="mt-6">
            <Button onClick={wallet.connect} loading={wallet.isConnecting}>
              Connect wallet
            </Button>
          </div>
        ) : null}
      </section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-10">
          {wallet.address ? <YourEndowments wallet={wallet} /> : null}
          {wallet.address ? <YourNames wallet={wallet} /> : null}
        </div>
        <div className="flex flex-col gap-10">
          <NameForm wallet={wallet} />
        </div>
      </div>
    </main>
  );
}

function YourEndowments({ wallet }: { wallet: Wallet }) {
  const now = useNow();
  const q = usePatron(wallet.address);
  const patronages = useMemo(
    () =>
      q.data?.patron
        ? [...q.data.patron.patronages].sort((a, b) => Number(a.name.expiry - b.name.expiry))
        : [],
    [q.data],
  );
  const labels = useMemo(() => patronages.map(p => p.endowment.label), [patronages]);
  const { runways } = useVaultRunways(labels);
  const { assets } = usePatronAssetsMany(labels, wallet.address);
  return (
    <section>
      <h2 className="mb-4">Your endowments</h2>
      {q.isLoading ? (
        <Spinner />
      ) : q.error ? (
        <p className="text-oxide">{q.error.message}</p>
      ) : patronages.length === 0 ? (
        <p className="text-muted">You have not endowed a name yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Expires</th>
                <th className="num">Your claim</th>
                <th>Funded</th>
                <th>Notice</th>
              </tr>
            </thead>
            <tbody>
              {patronages.map(p => {
                const runway = runways.get(p.endowment.label);
                const range =
                  runway && runway.assets > 0n
                    ? fundedRange(runway.fundedUntilLow, runway.fundedUntilHigh, p.name.expiry)
                    : undefined;
                const claim = assets.get(p.endowment.label);
                return (
                  <tr key={p.endowment.id}>
                    <td>
                      <NameLink label={p.endowment.label} />
                    </td>
                    <td className="whitespace-nowrap">{formatDate(p.name.expiry)}</td>
                    <td className="num whitespace-nowrap">
                      {claim === undefined ? <Spinner /> : formatDollars(claim)}
                    </td>
                    <td className="whitespace-nowrap text-verdigris">
                      {runway ? range ? range.text : 'not enough for a year' : <Spinner />}
                    </td>
                    <td className="whitespace-nowrap text-muted">
                      {p.noticeExecutableAt === null
                        ? 'none'
                        : p.noticeExecutableAt <= now
                          ? 'withdrawable'
                          : `from ${formatDate(p.noticeExecutableAt)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function YourNames({ wallet }: { wallet: Wallet }) {
  const now = useNow();
  const q = useOwnedNames(wallet.address);
  const names: readonly SubgraphName[] = q.data?.names ?? [];
  return (
    <section>
      <h2 className="mb-4">Your names</h2>
      {q.isLoading ? (
        <Spinner />
      ) : q.error ? (
        <p className="text-oxide">{q.error.message}</p>
      ) : names.length === 0 ? (
        <p className="text-muted">This wallet owns no registered .eth name on Sepolia.</p>
      ) : (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Expires</th>
                <th className="num">Dies in</th>
                <th>ENS</th>
                <th>Endowment</th>
              </tr>
            </thead>
            <tbody>
              {names.map(n => {
                const endowed = (n.endowment?.shares ?? 0n) > 0n;
                return (
                  <tr key={n.id}>
                    <td>
                      <NameLink label={n.label} />
                    </td>
                    <td className="whitespace-nowrap">{formatDate(n.expiry)}</td>
                    <td className="num whitespace-nowrap">
                      {formatDays(Number((n.expiry + GRACE_PERIOD_SECONDS - now) / DAY))}
                    </td>
                    <td>
                      <ExternalLink href={ensManagerName(n.label)} className="text-muted">
                        Manage
                      </ExternalLink>
                    </td>
                    <td>
                      {endowed ? (
                        <span className="text-verdigris">endowed</span>
                      ) : (
                        <Link
                          href={`/name/${encodeURIComponent(n.label)}`}
                          className="text-verdigris"
                        >
                          Endow
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const DURATIONS = [
  { label: '28 days, the minimum', seconds: 28n * DAY, note: 'renewable from day one' },
  { label: '1 year', seconds: SECONDS_PER_YEAR, note: '' },
  { label: '2 years', seconds: 2n * SECONDS_PER_YEAR, note: '' },
  { label: '3 years', seconds: 3n * SECONDS_PER_YEAR, note: '' },
  { label: '6 years', seconds: 6n * SECONDS_PER_YEAR, note: 'best to endow' },
] as const;
const DURATION_SECONDS: readonly bigint[] = DURATIONS.map(d => d.seconds);

// One field for any name. A registered one opens its card, where anyone may endow it; an
// available one is registered straight on the ENSv2 registrar: commit, wait a minute,
// register with MockUSDC, on the shared public resolver.
function NameForm({ wallet }: { wallet: Wallet }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [durationIndex, setDurationIndex] = useState(DURATIONS.length - 1);
  const label = normaliseLabel(text);
  const duration = DURATIONS[durationIndex]?.seconds ?? DURATIONS[0].seconds;
  const { isAvailable } = useIsAvailable(label);
  const { quotes } = useRegisterPrices(label, DURATION_SECONDS);
  const price = quotes[durationIndex];
  const register = useRegisterFlow();
  const taken = isAvailable === false;
  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (label.length < 3) return;
      if (taken) {
        router.push(`/name/${encodeURIComponent(label)}`);
        return;
      }
      if (!wallet.isConnected) {
        wallet.connect();
        return;
      }
      register.mutate(
        { label, duration },
        { onSuccess: () => router.push(`/name/${encodeURIComponent(label)}`) },
      );
    },
    [wallet, register, label, duration, router, taken],
  );

  const hint =
    label.length < 3
      ? 'At least three characters.'
      : isAvailable === undefined
        ? 'Checking the registrar.'
        : taken
          ? `${label}.eth is registered. Open it to endow it; you need not own it.`
          : price
            ? `${label}.eth is available: ${formatUsdc(price.base + price.premium)} USDC${price.premium > 0n ? `, of which ${formatUsdc(price.premium)} is the expiry premium` : ''}. Test USDC is minted for you if you are short.`
            : `${label}.eth is available.`;

  return (
    <Panel title="Endow existing, or register a new name">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field
          label="Name"
          suffix=".eth"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="alice"
          autoComplete="off"
          hint={hint}
          disabled={register.isPending}
        />
        {isAvailable === true ? (
          <>
            <label className="flex flex-col gap-1.5 text-sm text-muted">
              Term
              <select
                value={durationIndex}
                onChange={e => setDurationIndex(Number(e.target.value))}
                disabled={register.isPending}
                className="text-base text-ink"
              >
                {DURATIONS.map((d, i) => {
                  const quote = quotes[i];
                  const total = quote ? quote.base + quote.premium : undefined;
                  const years = d.seconds / SECONDS_PER_YEAR;
                  const priceText =
                    total === undefined
                      ? '…'
                      : years >= 2n
                        ? `${formatDollars(total)}, ${formatDollars(total / years)}/y`
                        : formatDollars(total);
                  const note = d.note ? ` (${d.note})` : '';
                  return (
                    <option key={d.label} value={i}>
                      {d.label}, {priceText}
                      {note}
                    </option>
                  );
                })}
              </select>
            </label>
            <p className="text-sm text-muted">
              Two transactions a minute apart, on the ENSv2 registrar itself; the name lands in your
              wallet on the shared public resolver, with Spirith as referrer. Stay on this page in
              between.
            </p>
          </>
        ) : null}
        <div>
          {taken ? (
            <Button type="submit" variant="secondary">
              Open {label}.eth to Endow
            </Button>
          ) : (
            <Button
              type="submit"
              loading={register.isPending}
              disabled={label.length < 3 || isAvailable !== true}
            >
              {label.length < 3
                ? 'Enter a name'
                : wallet.isConnected
                  ? `Register ${label}.eth`
                  : 'Connect to register'}
            </Button>
          )}
        </div>
      </form>
    </Panel>
  );
}
