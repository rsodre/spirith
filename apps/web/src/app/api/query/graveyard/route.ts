import { fetchGraveyard } from '@spirith/core';
import { errorResponse, jsonResponse, nowSeconds, subgraphConfig } from '@/server/subgraph';

export const dynamic = 'force-dynamic';

/** Names past their grace period, most recently lost last. */
export async function GET(): Promise<Response> {
  try {
    const now = nowSeconds();
    const names = await fetchGraveyard(subgraphConfig(), now, { first: 200 });
    return jsonResponse({ now, names });
  } catch (error) {
    return errorResponse(error);
  }
}
