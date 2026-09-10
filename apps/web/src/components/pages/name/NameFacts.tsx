import type { ReactNode } from 'react';
import {
  GRACE_PERIOD_SECONDS,
  SECONDS_PER_YEAR,
  type SubgraphNameDetail,
  type Tier,
  tierOf,
  tierRenewPrice,
} from '@spirith/core';
import type { Address } from 'viem';
import { AddressLink } from '@/components/AddressLink';
import { ExternalLink } from '@/components/ExternalLink';
import { Spinner } from '@/components/ui';
import { ZERO_ADDRESS } from '@/hooks/chain/contracts';
import type { SpirithRecords } from '@/hooks/chain/use-resolver';
import { ensExplorerName, ensManagerName } from '@/lib/links';
import { formatDate, formatUsdc, tierLabel } from '@/lib/format';

interface Props {
  label: string;
  now: bigint;
  expiry: bigint | undefined;
  owner: Address | undefined;
  resolver: Address | undefined;
  records: SpirithRecords | undefined;
  name: SubgraphNameDetail | null;
  /** The subgraph's last record-write result; null when never endowed. */
  recordWritten: boolean | null;
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{term}</dt>
      <dd>{children}</dd>
    </>
  );
}

// The facts, as a ruled list. Everything here is read from the chain except the counts.
export function NameFacts({ label, expiry, owner, resolver, records, name, recordWritten }: Props) {
  let tier: Tier | undefined;
  try {
    tier = tierOf(label);
  } catch {}
  const hasResolver = resolver !== undefined && resolver !== ZERO_ADDRESS;
  return (
    <section>
      <h2 className="mb-4">The name</h2>
      <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-base [&>dd]:min-w-0 [&>dd]:break-words">
        <Row term="Expiry">{expiry === undefined ? <Spinner /> : formatDate(expiry)}</Row>
        <Row term="Last day to renew">
          {expiry === undefined ? <Spinner /> : formatDate(expiry + GRACE_PERIOD_SECONDS)}
        </Row>
        <Row term="Tier">
          {tier === undefined ? (
            'invalid label'
          ) : (
            <>
              {tierLabel(tier)}, {formatUsdc(tierRenewPrice(tier, SECONDS_PER_YEAR))} USDC a year
            </>
          )}
        </Row>
        <Row term="Owner">
          {owner === undefined ? (
            <Spinner />
          ) : owner === ZERO_ADDRESS ? (
            <span className="text-muted">none</span>
          ) : (
            <span className="inline-flex flex-wrap items-center gap-3">
              <AddressLink address={owner} />
              <ExternalLink href={ensManagerName(label)} className="text-sm text-muted">
                Manage
              </ExternalLink>
            </span>
          )}
        </Row>
        <Row term="Resolver">
          {resolver === undefined ? (
            <Spinner />
          ) : hasResolver ? (
            <AddressLink address={resolver} />
          ) : (
            <span className="text-muted">none</span>
          )}
        </Row>
        <Row term="ENSv2 record">
          {resolver === undefined ? (
            <Spinner />
          ) : !hasResolver ? (
            <span className="text-muted">no resolver to write to</span>
          ) : records === undefined ? (
            <Spinner />
          ) : !records.supported ? (
            <span className="text-muted">not supported by this resolver</span>
          ) : records.fundedUntil !== null ? (
            <ExternalLink href={ensExplorerName(label)} className="text-verdigris">
              funded until {formatDate(records.fundedUntil)}
              {records.patrons !== null
                ? `, ${records.patrons} ${records.patrons === 1 ? 'patron' : 'patrons'}`
                : ''}
            </ExternalLink>
          ) : recordWritten === false ? (
            <span className="text-amber">not authorised by the owner</span>
          ) : (
            <span className="text-muted">not written yet</span>
          )}
        </Row>
        {name ? (
          <>
            <Row term="Registered">
              {formatDate(name.registeredAt)}
              {name.registrations > 1 ? `, ${name.registrations} times` : ''}
            </Row>
            <Row term="Renewals">
              {name.renewals === 0 ? (
                <span className="text-muted">Never renewed</span>
              ) : (
                <>
                  {name.renewals}
                  {name.endowmentDetail && name.endowmentDetail.renewals > 0
                    ? `, ${name.endowmentDetail.renewals} paid by Spirith`
                    : ''}
                </>
              )}
            </Row>
          </>
        ) : null}
      </dl>
    </section>
  );
}
