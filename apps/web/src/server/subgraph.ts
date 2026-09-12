import type { SubgraphConfig } from '@spirith/core';
import { APP_ENV } from '@/lib/chain';
import { stringifyJson } from '@/lib/json';

// Server-only: the environment's public Studio URL, unless SUBGRAPH_QUERY_URL overrides it with
// a gateway URL, whose key never reaches the browser. Route handlers under api/query call core's
// fetchers with this config and answer with bigint-safe JSON.
export function subgraphConfig(): SubgraphConfig {
  const url = process.env.SUBGRAPH_QUERY_URL || APP_ENV.subgraph?.url;
  if (!url)
    throw new Error(`no subgraph for the ${APP_ENV.name} environment; set SUBGRAPH_QUERY_URL`);
  return { url, apiKey: process.env.GRAPH_API_KEY || undefined };
}

export function nowSeconds(): bigint {
  return BigInt(Math.floor(Date.now() / 1000));
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(stringifyJson(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export function errorResponse(error: unknown, status = 500): Response {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[api/query]', message);
  return jsonResponse({ error: message }, status);
}
