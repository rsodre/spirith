import { fetchPatron } from '@spirith/core';
import { getAddress, isAddress } from 'viem';
import { errorResponse, jsonResponse, subgraphConfig } from '@/server/subgraph';

export const dynamic = 'force-dynamic';

/** One patron's claims across names; null when the address never endowed anything. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ address: string }> },
): Promise<Response> {
  try {
    const { address } = await context.params;
    if (!isAddress(address)) return errorResponse(new Error('not an address'), 400);
    const patron = await fetchPatron(subgraphConfig(), getAddress(address));
    return jsonResponse({ patron });
  } catch (error) {
    return errorResponse(error);
  }
}
