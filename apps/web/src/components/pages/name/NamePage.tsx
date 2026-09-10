'use client';

import { useMemo } from 'react';
import { GRACE_PERIOD_SECONDS, liveness } from '@spirith/core';
import { ExternalLink } from '@/components/ExternalLink';
import { BandMark, Spinner } from '@/components/ui';
import { useNameExpiry, useNameOwner, useNameResolver } from '@/hooks/chain/use-registry';
import { useIsRenewable } from '@/hooks/chain/use-registrar';
import { useSpirithRecords } from '@/hooks/chain/use-resolver';
import { useVaultConstants, useVaultRunway } from '@/hooks/chain/use-vault';
import { useWallet } from '@/hooks/chain/use-wallet';
import { useName } from '@/hooks/queries/use-name';
import { useNow } from '@/hooks/use-now';
import { useSlugs } from '@/hooks/use-slugs';
import { ZERO_ADDRESS } from '@/hooks/chain/contracts';
import { ENS_EXPLORER_HOST, ensExplorerName } from '@/lib/links';
import { formatDate, formatDays, fundedRange, yearsUntil } from '@/lib/format';
import { EndowmentPanel } from './EndowmentPanel';
import { NameFacts } from './NameFacts';
import { OwnerPanel } from './OwnerPanel';
import { PatronPanel } from './PatronPanel';
import { RenewPanel } from './RenewPanel';
import { RenewalHistory } from './RenewalHistory';

// The name card. Expiry, owner and resolver come from the chain so an indexing lag never
// shows a stale name; the subgraph supplies history and the endowment's ledger.
export function NamePage() {
  const { label } = useSlugs();
  const now = useNow();
  const wallet = useWallet();
  const detail = useName(label);
  const { expiry, isLoading: expiryLoading, error: expiryError } = useNameExpiry(label);
  const { owner } = useNameOwner(label);
  const { resolver } = useNameResolver(label);
  const { isRenewable } = useIsRenewable(label);
  const { runway: runwayRead, error: runwayError } = useVaultRunway(label);
  // `runwayOf` reverts for a name the registrar cannot price (a v1 reservation, an invalid
  // label); null tells the panels "no runway" so nothing spins forever.
  const runway = runwayError ? null : runwayRead;
  const { constants } = useVaultConstants();
  const { records } = useSpirithRecords(label, resolver);

  const name = detail.data?.name ?? null;
  const endowed = (runway?.assets ?? 0n) > 0n;
  const registered = expiry !== undefined && expiry > 0n;

  const live = useMemo(() => {
    if (!registered || runway === undefined) return undefined;
    if (runway === null) return liveness({ expiry, now, endowed: false });
    return liveness({
      expiry,
      now,
      endowed,
      runwayLowYears: yearsUntil(now, runway.fundedUntilLow),
    });
  }, [registered, expiry, now, endowed, runway]);

  // Honest UI rule (spec §4.4): a range, collapsing to one date when the rate range does.
  const funded = useMemo(
    () =>
      registered && runway != null && endowed && runway.fundedUntilLow > expiry
        ? fundedRange(runway.fundedUntilLow, runway.fundedUntilHigh, expiry)
        : undefined,
    [registered, runway, endowed, expiry],
  );

  // A v1 name mirrored into the beta registry: reserved, no owner, not renewable through the
  // v2 registrar (spec §2). Its owner has to migrate it before anyone can endow it.
  const v1Reserved = registered && owner === ZERO_ADDRESS && isRenewable === false;

  const isOwner = owner !== undefined && wallet.address !== undefined && owner === wallet.address;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <section className="mb-10">
        <h1 className="text-5xl md:text-6xl">
          {label}
          <span className="text-muted">.eth</span>
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-title text-xl text-muted">
          {expiryLoading ? (
            <Spinner />
          ) : expiryError ? (
            <span className="text-oxide">
              The registry could not be read: {expiryError.message}
            </span>
          ) : !registered ? (
            <span>Not registered on the ENSv2 Sepolia registry.</span>
          ) : (
            <>
              {live ? <BandMark band={live.band} className="text-xl" /> : null}
              <span>
                {funded
                  ? `funded ${funded.perpetual ? 'indefinitely at current rates' : `until ${formatDate(funded.low)}${funded.high > funded.low ? ` to ${formatDate(funded.high)}` : ''}`}`
                  : expiry > now
                    ? `expires ${formatDate(expiry)}, in ${formatDays(Number((expiry - now) / 86_400n))}`
                    : expiry + GRACE_PERIOD_SECONDS > now
                      ? `expired ${formatDate(expiry)}; renewable for ${formatDays(Number((expiry + GRACE_PERIOD_SECONDS - now) / 86_400n))} more`
                      : `lapsed on ${formatDate(expiry + GRACE_PERIOD_SECONDS)}`}
              </span>
              <ExternalLink href={ensExplorerName(label)} className="text-base text-muted">
                {ENS_EXPLORER_HOST}
              </ExternalLink>
            </>
          )}
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-10">
          <NameFacts
            label={label}
            now={now}
            expiry={registered ? expiry : undefined}
            owner={owner}
            resolver={resolver}
            records={records}
            name={name}
            recordWritten={name?.endowmentDetail?.recordWritten ?? null}
          />
          {isOwner ? (
            <OwnerPanel
              label={label}
              resolver={resolver}
              records={records}
              recordWritten={name?.endowmentDetail?.recordWritten ?? null}
            />
          ) : null}
          <RenewalHistory renewals={name?.renewalEvents ?? EMPTY} isLoading={detail.isLoading} />
          <RenewPanel
            label={label}
            now={now}
            expiry={registered ? expiry : undefined}
            runway={runway}
            constants={constants}
            renewable={isRenewable}
            v1Reserved={v1Reserved}
            wallet={wallet}
          />
        </div>
        <div className="flex flex-col gap-10">
          <EndowmentPanel
            label={label}
            expiry={registered ? expiry : undefined}
            runway={runway}
            constants={constants}
            endowment={name?.endowmentDetail ?? null}
            renewable={isRenewable}
            v1Reserved={v1Reserved}
            wallet={wallet}
          />
          <PatronPanel label={label} now={now} constants={constants} wallet={wallet} />
        </div>
      </div>
    </main>
  );
}

const EMPTY: readonly never[] = [];
