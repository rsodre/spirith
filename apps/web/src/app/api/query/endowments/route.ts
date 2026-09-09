import { fetchEndowments } from '@spirith/core';
import { errorResponse, jsonResponse, nowSeconds, subgraphConfig } from '@/server/subgraph';

export const dynamic = 'force-dynamic';

/** Live endowments with their names, largest principal first. */
export async function GET(): Promise<Response> {
  try {
    const now = nowSeconds();
    const endowments = await fetchEndowments(subgraphConfig(), { first: 200 });
    return jsonResponse({ now, endowments });
  } catch (error) {
    return errorResponse(error);
  }
}
