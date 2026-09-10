import { type Hex, namehash, toHex } from 'viem';

/** ENS namehash of `<label>.eth`, what resolvers key their records by. */
export function nameNode(label: string): Hex {
  return namehash(`${label}.eth`);
}

/** DNS wire encoding of `<label>.eth`, what resolver authorisations and ENSIP-10 reads take. */
export function dnsEncodeEth(label: string): Hex {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(label);
  if (bytes.length === 0 || bytes.length > 255) throw new Error(`label not encodable: ${label}`);
  const out = new Uint8Array(1 + bytes.length + 1 + 3 + 1);
  out[0] = bytes.length;
  out.set(bytes, 1);
  out[1 + bytes.length] = 3;
  out.set(encoder.encode('eth'), 2 + bytes.length);
  return toHex(out);
}
