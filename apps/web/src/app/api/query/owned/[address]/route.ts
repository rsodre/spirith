import { fetchNamesOwnedBy } from '@spirith/core';
import { getAddress, isAddress } from 'viem';
import { errorResponse, jsonResponse, nowSeconds, subgraphConfig } from '@/server/subgraph';

export const dynamic = 'force-dynamic';

/** Registered names an address owns, soonest expiry first. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ address: string }> },
): Promise<Response> {
  try {
    const { address } = await context.params;
    if (!isAddress(address)) return errorResponse(new Error('not an address'), 400);
    const now = nowSeconds();
    const names = await fetchNamesOwnedBy(subgraphConfig(), getAddress(address), { first: 200 });
    return jsonResponse({ now, names });
  } catch (error) {
    return errorResponse(error);
  }
}
