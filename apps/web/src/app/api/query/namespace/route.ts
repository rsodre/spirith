import { fetchNamespace } from '@spirith/core';
import { errorResponse, jsonResponse, subgraphConfig } from '@/server/subgraph';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    return jsonResponse(await fetchNamespace(subgraphConfig()));
  } catch (error) {
    return errorResponse(error);
  }
}
