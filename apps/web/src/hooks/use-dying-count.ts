'use client';

import { useNamesAtRisk } from '@/hooks/queries/use-names-at-risk';

const WINDOW_DAYS = 28;

/** How many registered names expire within the next 28 days, grace included. */
export function useDyingCount() {
  const q = useNamesAtRisk(WINDOW_DAYS);
  return {
    count: q.data?.names.length,
    grace: q.data?.names.filter(n => n.expiry <= q.data.now).length,
    isLoading: q.isLoading,
    error: q.error,
    windowDays: WINDOW_DAYS,
  };
}
