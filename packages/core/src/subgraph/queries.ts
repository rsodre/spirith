// The queries the dashboard and agent run, with the wire shape parsed into bigint at the edge.
// Every reader of the subgraph goes through this module; nothing else knows the schema.
import { type Address, type Hex, getAddress, keccak256, stringToBytes } from 'viem';
import { querySubgraph, type SubgraphConfig } from './client.js';
import type {
  SubgraphEndowment,
  SubgraphEndowmentSummary,
  SubgraphMeta,
  SubgraphName,
  SubgraphNameDetail,
  SubgraphNamespace,
  SubgraphPatron,
  SubgraphPatronage,
  SubgraphRenewal,
} from './types.js';

export const GRACE_PERIOD_SECONDS = 28n * 86_400n;
export const NAMESPACE_ID = 'sepolia';

export function labelhash(label: string): Hex {
  return keccak256(stringToBytes(label));
}

// Wire shapes: graph-node serialises BigInt as decimal strings and Bytes as hex strings.
const big = (s: string): bigint => BigInt(s);
const bigOrNull = (s: string | null): bigint | null => (s == null ? null : BigInt(s));
const addr = (s: string): Address => getAddress(s);
const addrOrNull = (s: string | null): Address | null => (s == null ? null : getAddress(s));

const NAME_FIELDS = `
  id label length tier owner resolver expiry status registeredAt renewals lastRenewedAt
  endowment { principal shares patronCount renewals recordWritten }
`;

interface WireEndowmentSummary {
  principal: string;
  shares: string;
  patronCount: number;
  renewals: number;
  recordWritten: boolean;
}

interface WireName {
  id: Hex;
  label: string;
  length: number;
  tier: number;
  owner: string;
  resolver: string | null;
  expiry: string;
  status: 'Registered' | 'Unregistered';
  registeredAt: string;
  renewals: number;
  lastRenewedAt: string | null;
  endowment: WireEndowmentSummary | null;
}

function parseSummary(w: WireEndowmentSummary): SubgraphEndowmentSummary {
  return {
    principal: big(w.principal),
    shares: big(w.shares),
    patronCount: w.patronCount,
    renewals: w.renewals,
    recordWritten: w.recordWritten,
  };
}

function parseName(w: WireName): SubgraphName {
  return {
    id: w.id,
    label: w.label,
    length: w.length,
    tier: w.tier,
    owner: addr(w.owner),
    resolver: addrOrNull(w.resolver),
    expiry: big(w.expiry),
    status: w.status,
    registeredAt: big(w.registeredAt),
    renewals: w.renewals,
    lastRenewedAt: bigOrNull(w.lastRenewedAt),
    endowment: w.endowment ? parseSummary(w.endowment) : null,
  };
}

interface WirePatronage {
  patron: { id: string };
  shares: string;
  contributed: string;
  withdrawn: string;
  noticeShares: string;
  noticeExecutableAt: string | null;
}

function parsePatronage(w: WirePatronage): SubgraphPatronage {
  return {
    patron: addr(w.patron.id),
    shares: big(w.shares),
    contributed: big(w.contributed),
    withdrawn: big(w.withdrawn),
    noticeShares: big(w.noticeShares),
    noticeExecutableAt: bigOrNull(w.noticeExecutableAt),
  };
}

interface WireRenewal {
  id: Hex;
  duration: string;
  newExpiry: string;
  amount: string;
  viaSpirith: boolean;
  keeper: string | null;
  tip: string | null;
  recordWritten: boolean | null;
  timestamp: string;
  txHash: Hex;
}

function parseRenewal(w: WireRenewal): SubgraphRenewal {
  return {
    id: w.id,
    duration: big(w.duration),
    newExpiry: big(w.newExpiry),
    amount: big(w.amount),
    viaSpirith: w.viaSpirith,
    keeper: addrOrNull(w.keeper),
    tip: bigOrNull(w.tip),
    recordWritten: w.recordWritten,
    timestamp: big(w.timestamp),
    txHash: w.txHash,
  };
}

const ENDOWMENT_FIELDS = `
  id label contributed withdrawn spent tipsPaid principal shares patronCount renewals
  lastRenewedAt recordWritten createdAt
  patronages { patron { id } shares contributed withdrawn noticeShares noticeExecutableAt }
`;

interface WireEndowment extends WireEndowmentSummary {
  id: Hex;
  label: string;
  contributed: string;
  withdrawn: string;
  spent: string;
  tipsPaid: string;
  lastRenewedAt: string | null;
  createdAt: string;
  patronages: WirePatronage[];
}

function parseEndowment(w: WireEndowment): SubgraphEndowment {
  return {
    ...parseSummary(w),
    id: w.id,
    label: w.label,
    contributed: big(w.contributed),
    withdrawn: big(w.withdrawn),
    spent: big(w.spent),
    tipsPaid: big(w.tipsPaid),
    lastRenewedAt: bigOrNull(w.lastRenewedAt),
    createdAt: big(w.createdAt),
    patronages: w.patronages.map(parsePatronage),
  };
}

export interface NamesQuery {
  /** Only names with `expiry < before` (unix seconds). */
  readonly expiryBefore?: bigint;
  /** Only names with `expiry >= after`. */
  readonly expiryAfter?: bigint;
  readonly endowedOnly?: boolean;
  readonly first?: number;
  readonly skip?: number;
}

/** Registered names ordered by expiry, soonest first. */
export async function fetchNames(
  config: SubgraphConfig,
  q: NamesQuery = {},
): Promise<readonly SubgraphName[]> {
  const where: Record<string, unknown> = { status: 'Registered' };
  if (q.expiryBefore !== undefined) where.expiry_lt = q.expiryBefore.toString();
  if (q.expiryAfter !== undefined) where.expiry_gte = q.expiryAfter.toString();
  if (q.endowedOnly) where.endowment_ = { shares_gt: '0' };
  const data = await querySubgraph<{ names: WireName[] }>(
    config,
    `query Names($where: Name_filter!, $first: Int!, $skip: Int!) {
      names(where: $where, orderBy: expiry, orderDirection: asc, first: $first, skip: $skip) {
        ${NAME_FIELDS}
      }
    }`,
    { where, first: q.first ?? 100, skip: q.skip ?? 0 },
  );
  return data.names.map(parseName);
}

/** Names expiring within `withinSeconds` of `now`, including names already in grace. */
export function fetchNamesAtRisk(
  config: SubgraphConfig,
  now: bigint,
  withinSeconds: bigint,
  opts: Omit<NamesQuery, 'expiryBefore' | 'expiryAfter'> = {},
): Promise<readonly SubgraphName[]> {
  return fetchNames(config, {
    ...opts,
    expiryBefore: now + withinSeconds,
    expiryAfter: now - GRACE_PERIOD_SECONDS,
  });
}

/** Names past their grace period: lapsed, but never released by the registry. */
export function fetchGraveyard(
  config: SubgraphConfig,
  now: bigint,
  opts: Pick<NamesQuery, 'first' | 'skip'> = {},
): Promise<readonly SubgraphName[]> {
  return fetchNames(config, { ...opts, expiryBefore: now - GRACE_PERIOD_SECONDS });
}

interface WireNameDetail extends WireName {
  tokenId: string;
  registeredBy: string;
  registrationAmount: string;
  registrations: number;
  endowmentDetail: WireEndowment | null;
  renewalEvents: WireRenewal[];
}

export async function fetchName(
  config: SubgraphConfig,
  label: string,
): Promise<SubgraphNameDetail | null> {
  const data = await querySubgraph<{ name: WireNameDetail | null }>(
    config,
    `query Name($id: Bytes!) {
      name(id: $id) {
        ${NAME_FIELDS}
        tokenId registeredBy registrationAmount registrations
        endowmentDetail: endowment { ${ENDOWMENT_FIELDS} }
        renewalEvents(orderBy: timestamp, orderDirection: desc, first: 50) {
          id duration newExpiry amount viaSpirith keeper tip recordWritten timestamp txHash
        }
      }
    }`,
    { id: labelhash(label) },
  );
  const w = data.name;
  if (w == null) return null;
  return {
    ...parseName(w),
    tokenId: big(w.tokenId),
    registeredBy: addr(w.registeredBy),
    registrationAmount: big(w.registrationAmount),
    registrations: w.registrations,
    endowmentDetail: w.endowmentDetail ? parseEndowment(w.endowmentDetail) : null,
    renewalEvents: w.renewalEvents.map(parseRenewal),
  };
}

/** Live endowments (shares > 0) with their names, largest principal first. */
export async function fetchEndowments(
  config: SubgraphConfig,
  opts: Pick<NamesQuery, 'first' | 'skip'> = {},
): Promise<readonly (SubgraphEndowment & { readonly name: SubgraphName })[]> {
  const data = await querySubgraph<{ endowments: (WireEndowment & { name: WireName })[] }>(
    config,
    `query Endowments($first: Int!, $skip: Int!) {
      endowments(where: { shares_gt: "0" }, orderBy: principal, orderDirection: desc, first: $first, skip: $skip) {
        ${ENDOWMENT_FIELDS}
        name { ${NAME_FIELDS} }
      }
    }`,
    { first: opts.first ?? 100, skip: opts.skip ?? 0 },
  );
  return data.endowments.map(w => ({ ...parseEndowment(w), name: parseName(w.name) }));
}

interface WirePatron {
  id: string;
  contributed: string;
  withdrawn: string;
  namesSupported: number;
  patronages: (WirePatronage & {
    endowment: {
      id: Hex;
      label: string;
      principal: string;
      name: { expiry: string; tier: number };
    };
  })[];
}

export async function fetchPatron(
  config: SubgraphConfig,
  address: Address,
): Promise<SubgraphPatron | null> {
  const data = await querySubgraph<{ patron: WirePatron | null }>(
    config,
    `query Patron($id: Bytes!) {
      patron(id: $id) {
        id contributed withdrawn namesSupported
        patronages(where: { shares_gt: "0" }) {
          patron { id } shares contributed withdrawn noticeShares noticeExecutableAt
          endowment { id label principal name { expiry tier } }
        }
      }
    }`,
    { id: address.toLowerCase() },
  );
  const w = data.patron;
  if (w == null) return null;
  return {
    id: addr(w.id),
    contributed: big(w.contributed),
    withdrawn: big(w.withdrawn),
    namesSupported: w.namesSupported,
    patronages: w.patronages.map(p => ({
      ...parsePatronage(p),
      endowment: {
        id: p.endowment.id,
        label: p.endowment.label,
        principal: big(p.endowment.principal),
      },
      name: { expiry: big(p.endowment.name.expiry), tier: p.endowment.name.tier },
    })),
  };
}

interface WireNamespace {
  namespace: {
    names: number;
    activeNames: number;
    endowedNames: number;
    registrations: number;
    renewals: number;
    spirithRenewals: number;
    endowedVolume: string;
    principal: string;
    renewalSpend: string;
    tipsPaid: string;
    updatedAt: string;
  } | null;
  _meta: { block: { number: number }; hasIndexingErrors: boolean };
}

export async function fetchNamespace(
  config: SubgraphConfig,
): Promise<{ readonly namespace: SubgraphNamespace | null; readonly meta: SubgraphMeta }> {
  const data = await querySubgraph<WireNamespace>(
    config,
    `query Namespace($id: ID!) {
      namespace(id: $id) {
        names activeNames endowedNames registrations renewals spirithRenewals
        endowedVolume principal renewalSpend tipsPaid updatedAt
      }
      _meta { block { number } hasIndexingErrors }
    }`,
    { id: NAMESPACE_ID },
  );
  const n = data.namespace;
  return {
    namespace: n
      ? {
          names: n.names,
          activeNames: n.activeNames,
          endowedNames: n.endowedNames,
          registrations: n.registrations,
          renewals: n.renewals,
          spirithRenewals: n.spirithRenewals,
          endowedVolume: big(n.endowedVolume),
          principal: big(n.principal),
          renewalSpend: big(n.renewalSpend),
          tipsPaid: big(n.tipsPaid),
          updatedAt: big(n.updatedAt),
        }
      : null,
    meta: { block: data._meta.block.number, hasIndexingErrors: data._meta.hasIndexingErrors },
  };
}
