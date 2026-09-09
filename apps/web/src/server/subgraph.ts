import type { SubgraphConfig } from '@spirith/core';
import { stringifyJson } from '@/lib/json';

// Server-only: the query URL and any gateway key never reach the browser. Route handlers under
// api/query call core's fetchers with this config and answer with bigint-safe JSON.
export function subgraphConfig(): SubgraphConfig {
  const url = process.env.SUBGRAPH_QUERY_URL;
  if (!url) throw new Error('SUBGRAPH_QUERY_URL is not set');
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
