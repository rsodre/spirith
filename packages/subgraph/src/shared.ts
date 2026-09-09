// Helpers shared by the three mappings. AssemblyScript, compiled by `graph build`.
import { BigInt, Bytes, ByteArray, crypto, ethereum } from '@graphprotocol/graph-ts';
import { Name, Namespace, Token } from '../generated/schema';

export const NAMESPACE_ID = 'sepolia';
export const ZERO = BigInt.zero();

export function namespace(): Namespace {
  let ns = Namespace.load(NAMESPACE_ID);
  if (ns == null) {
    ns = new Namespace(NAMESPACE_ID);
    ns.names = 0;
    ns.activeNames = 0;
    ns.endowedNames = 0;
    ns.registrations = 0;
    ns.renewals = 0;
    ns.spirithRenewals = 0;
    ns.endowedVolume = ZERO;
    ns.principal = ZERO;
    ns.renewalSpend = ZERO;
    ns.tipsPaid = ZERO;
    ns.updatedAt = ZERO;
  }
  return ns;
}

export function labelhash(label: string): Bytes {
  return Bytes.fromByteArray(crypto.keccak256(ByteArray.fromUTF8(label)));
}

/** A registry token id with its low 32 bits (the version counter) cleared, as 32 bytes. */
export function canonicalId(tokenId: BigInt): Bytes {
  const bytes = new Bytes(32);
  // BigInt is little-endian; the id is unsigned and at most 32 bytes.
  const raw = Bytes.fromBigInt(tokenId);
  for (let i = 0; i < 32; i++) {
    bytes[31 - i] = i < raw.length ? raw[i] : 0;
  }
  bytes[28] = 0;
  bytes[29] = 0;
  bytes[30] = 0;
  bytes[31] = 0;
  return bytes;
}

export function nameByTokenId(tokenId: BigInt): Name | null {
  const token = Token.load(canonicalId(tokenId));
  if (token == null) return null;
  return Name.load(token.name);
}

/** Codepoint count, as the rent oracle's `getLength` and core's `labelLength`. */
export function codepointLength(label: string): i32 {
  let n = 0;
  for (let i = 0; i < label.length; i++) {
    const c = label.charCodeAt(i);
    // Skip the low surrogate of a pair so an astral character counts once.
    if (c >= 0xdc00 && c <= 0xdfff) continue;
    n++;
  }
  return n;
}

export function tierOf(length: i32): i32 {
  return length >= 5 ? 5 : length;
}

export function eventId(event: ethereum.Event): Bytes {
  return event.transaction.hash.concatI32(event.logIndex.toI32());
}
