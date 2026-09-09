import Link from 'next/link';
import { cn } from '@/lib/cn';

// Every mention of a name on a list is a link to its card.
export function NameLink({ label, className }: { label: string; className?: string }) {
  return (
    <Link
      href={`/name/${encodeURIComponent(label)}`}
      className={cn('font-title text-lg', className)}
    >
      {label}
      <span className="text-muted">.eth</span>
    </Link>
  );
}
