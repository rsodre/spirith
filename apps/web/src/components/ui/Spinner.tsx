import { LoadingIcon } from '@/icons';
import { cn } from '@/lib/cn';

// Occupies the box of the value it stands in for, so nothing reflows when the answer lands.
export function Spinner({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center text-muted', className)}>
      <LoadingIcon size="sm" className="motion-safe:animate-spin" label="loading" />
    </span>
  );
}
