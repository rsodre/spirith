// Entities as the dashboard and agent consume them: chain numerics as bigint, ids as hex.
// The wire shape (BigInt as decimal string) never leaves this module; see queries.ts.
import type { Address, Hex } from 'viem';

export type NameStatus = 'Registered' | 'Unregistered';

export interface SubgraphNamespace {
  readonly names: number;
  readonly activeNames: number;
  readonly endowedNames: number;
  readonly registrations: number;
  readonly renewals: number;
  readonly spirithRenewals: number;
  readonly endowedVolume: bigint;
  readonly principal: bigint;
  readonly renewalSpend: bigint;
  readonly tipsPaid: bigint;
  readonly updatedAt: bigint;
}

export interface SubgraphEndowmentSummary {
  readonly principal: bigint;
  readonly shares: bigint;
  readonly patronCount: number;
  readonly renewals: number;
  readonly recordWritten: boolean;
}

export interface SubgraphName {
  /** labelhash */
  readonly id: Hex;
  readonly label: string;
  readonly length: number;
  readonly tier: number;
  readonly owner: Address;
  readonly resolver: Address | null;
  readonly expiry: bigint;
  readonly status: NameStatus;
  readonly registeredAt: bigint;
  readonly renewals: number;
  readonly lastRenewedAt: bigint | null;
  /** Present once the name has ever been endowed; `shares === 0n` means the earmark is empty. */
  readonly endowment: SubgraphEndowmentSummary | null;
}

export interface SubgraphPatronage {
  readonly patron: Address;
  readonly shares: bigint;
  readonly contributed: bigint;
  readonly withdrawn: bigint;
  readonly noticeShares: bigint;
  readonly noticeExecutableAt: bigint | null;
}

export interface SubgraphRenewal {
  readonly id: Hex;
  readonly duration: bigint;
  readonly newExpiry: bigint;
  readonly amount: bigint;
  readonly viaSpirith: boolean;
  readonly keeper: Address | null;
  readonly tip: bigint | null;
  readonly recordWritten: boolean | null;
  readonly timestamp: bigint;
  readonly txHash: Hex;
}

export interface SubgraphEndowment extends SubgraphEndowmentSummary {
  readonly id: Hex;
  readonly label: string;
  readonly contributed: bigint;
  readonly withdrawn: bigint;
  readonly spent: bigint;
  readonly tipsPaid: bigint;
  readonly lastRenewedAt: bigint | null;
  readonly createdAt: bigint;
  readonly patronages: readonly SubgraphPatronage[];
}

export interface SubgraphNameDetail extends SubgraphName {
  readonly tokenId: bigint;
  readonly registeredBy: Address;
  readonly registrationAmount: bigint;
  readonly registrations: number;
  readonly endowmentDetail: SubgraphEndowment | null;
  readonly renewalEvents: readonly SubgraphRenewal[];
}

export interface SubgraphPatron {
  readonly id: Address;
  readonly contributed: bigint;
  readonly withdrawn: bigint;
  readonly namesSupported: number;
  readonly patronages: readonly (SubgraphPatronage & {
    readonly endowment: { readonly id: Hex; readonly label: string; readonly principal: bigint };
    readonly name: { readonly expiry: bigint; readonly tier: number };
  })[];
}

export interface SubgraphMeta {
  readonly block: number;
  readonly hasIndexingErrors: boolean;
}
