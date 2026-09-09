'use client';

import { useEffect, useState } from 'react';

function nowSeconds(): bigint {
  return BigInt(Math.floor(Date.now() / 1000));
}

/** Unix seconds, refreshed once a minute; every read-time computation (bands, days) uses it. */
export function useNow(): bigint {
  const [now, setNow] = useState(nowSeconds);
  useEffect(() => {
    const interval = setInterval(() => setNow(nowSeconds()), 60_000);
    return () => clearInterval(interval);
  }, []);
  return now;
}
