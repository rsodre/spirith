import { fetchNamesAtRisk } from '@spirith/core';
import type { NextRequest } from 'next/server';
import { errorResponse, jsonResponse, nowSeconds, subgraphConfig } from '@/server/subgraph';

export const dynamic = 'force-dynamic';

const DAY = 86_400n;
const MAX_DAYS = 365;

/** `?days=28`: registered names expiring within that window, including those in grace.
 * `days=0` is the grace list alone: expired, still renewable. */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const raw = Number(request.nextUrl.searchParams.get('days') ?? '28');
    const days = Number.isInteger(raw) && raw >= 0 ? Math.min(raw, MAX_DAYS) : 28;
    const now = nowSeconds();
    const names = await fetchNamesAtRisk(subgraphConfig(), now, BigInt(days) * DAY, {
      first: 500,
    });
    return jsonResponse({ now, days, names });
  } catch (error) {
    return errorResponse(error);
  }
}
