'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

// `invalidateKey` matches any query whose key includes the segment, so `invalidateKey(label)`
// refreshes every subgraph query keyed on that name. wagmi keys its reads with one object, so
// chain reads are refreshed by `invalidateAll` from the write hooks instead.
export function useQueryInvalidate() {
  const queryClient = useQueryClient();

  const invalidateKey = useCallback(
    (key: unknown) => {
      void queryClient.invalidateQueries({ predicate: query => query.queryKey.includes(key) });
    },
    [queryClient],
  );

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries();
  }, [queryClient]);

  return { invalidateKey, invalidateAll };
}
