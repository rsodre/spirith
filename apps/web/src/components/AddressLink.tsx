import type { Address, Hex } from 'viem';
import { explorerAddress, explorerTx } from '@/lib/chain';
import { shortAddress, shortHash } from '@/lib/format';
import { ExternalLink } from './ExternalLink';

export function AddressLink({ address, className }: { address: Address; className?: string }) {
  return (
    <ExternalLink href={explorerAddress(address)} className={className}>
      <code title={address}>{shortAddress(address)}</code>
    </ExternalLink>
  );
}

export function TxLink({ hash, className }: { hash: Hex; className?: string }) {
  return (
    <ExternalLink href={explorerTx(hash)} className={className}>
      <code title={hash}>{shortHash(hash)}</code>
    </ExternalLink>
  );
}
