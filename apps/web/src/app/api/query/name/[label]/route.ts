import { fetchName } from '@spirith/core';
import { errorResponse, jsonResponse, subgraphConfig } from '@/server/subgraph';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ label: string }> },
): Promise<Response> {
  try {
    const { label } = await context.params;
    const name = await fetchName(subgraphConfig(), decodeURIComponent(label).toLowerCase());
    return jsonResponse({ name });
  } catch (error) {
    return errorResponse(error);
  }
}
