'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

// A live timer in transaction toasts, counting up from startedAt.
export function ElapsedTimeBadge({
  startedAt,
  className,
}: {
  startedAt: number;
  className?: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const update = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <span className={cn('inline-block font-mono text-xs tabular-nums', className)}>
      {pad(minutes)}:{pad(seconds)}
    </span>
  );
}
