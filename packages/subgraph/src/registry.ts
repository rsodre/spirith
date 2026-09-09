// ETHRegistry: the name's lifecycle (registration, expiry, owner, resolver, release).
import { Address } from '@graphprotocol/graph-ts';
import {
  ExpiryUpdated,
  LabelRegistered,
  LabelUnregistered,
  ResolverUpdated,
  TokenRegenerated,
  TransferSingle,
} from '../generated/ETHRegistry/ETHRegistry';
import { Name, Token } from '../generated/schema';
import { ZERO, canonicalId, codepointLength, nameByTokenId, namespace, tierOf } from './shared';

export function handleLabelRegistered(event: LabelRegistered): void {
  const ns = namespace();
  const id = event.params.labelHash;
  let name = Name.load(id);
  if (name == null) {
    name = new Name(id);
    name.label = event.params.label;
    name.length = codepointLength(event.params.label);
    name.tier = tierOf(name.length);
    name.registrations = 0;
    name.renewals = 0;
    name.registrationAmount = ZERO;
    ns.names += 1;
  } else if (name.status == 'Registered') {
    // Re-registration without an unregister event: the previous term lapsed.
    ns.activeNames -= 1;
  }
  name.tokenId = event.params.tokenId;
  name.owner = event.params.owner;
  name.resolver = null;
  name.expiry = event.params.expiry;
  name.status = 'Registered';
  name.registeredAt = event.block.timestamp;
  name.registeredBy = event.params.sender;
  name.registrationAmount = ZERO;
  name.registrations += 1;
  name.updatedAt = event.block.timestamp;
  name.save();

  const token = new Token(canonicalId(event.params.tokenId));
  token.name = name.id;
  token.save();

  ns.activeNames += 1;
  ns.registrations += 1;
  ns.updatedAt = event.block.timestamp;
  ns.save();
}

export function handleExpiryUpdated(event: ExpiryUpdated): void {
  const name = nameByTokenId(event.params.tokenId);
  if (name == null) return;
  name.expiry = event.params.newExpiry;
  name.updatedAt = event.block.timestamp;
  name.save();
}

export function handleTransferSingle(event: TransferSingle): void {
  if (event.params.to.equals(Address.zero())) return; // burn; LabelUnregistered follows
  const name = nameByTokenId(event.params.id);
  if (name == null) return;
  name.owner = event.params.to;
  name.updatedAt = event.block.timestamp;
  name.save();
}

export function handleResolverUpdated(event: ResolverUpdated): void {
  const name = nameByTokenId(event.params.tokenId);
  if (name == null) return;
  name.resolver = event.params.resolver.equals(Address.zero()) ? null : event.params.resolver;
  name.updatedAt = event.block.timestamp;
  name.save();
}

export function handleLabelUnregistered(event: LabelUnregistered): void {
  const name = nameByTokenId(event.params.tokenId);
  if (name == null || name.status != 'Registered') return;
  name.status = 'Unregistered';
  name.updatedAt = event.block.timestamp;
  name.save();

  const ns = namespace();
  ns.activeNames -= 1;
  ns.updatedAt = event.block.timestamp;
  ns.save();
}

export function handleTokenRegenerated(event: TokenRegenerated): void {
  const name = nameByTokenId(event.params.oldTokenId);
  if (name == null) return;
  name.tokenId = event.params.newTokenId;
  name.updatedAt = event.block.timestamp;
  name.save();
  // The canonical id is unchanged, so the Token row still resolves.
}
