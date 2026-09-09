import type { AnchorHTMLAttributes } from 'react';
import { ExternalIcon } from '@/icons';
import { cn } from '@/lib/cn';

// A link that leaves the app: explorer, ENS apps. The mark says so.
export function ExternalLink({
  className,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      target="_blank"
      rel="noreferrer"
      className={cn('inline-flex items-center gap-1 text-ink', className)}
      {...rest}
    >
      {children}
      <ExternalIcon size="xs" className="text-muted" />
    </a>
  );
}
