import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

// A bounded region for something the reader acts on or must read as one unit (an endowment,
// a form, a bench section). Lists and facts are not panels: they sit on the page as a
// register, ruled not boxed.
export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  aside?: ReactNode;
}

export function Panel({ title, aside, className, children, ...rest }: PanelProps) {
  return (
    <section
      className={cn('rounded-sm border border-line bg-panel p-5 shadow-panel', className)}
      {...rest}
    >
      {title !== undefined || aside !== undefined ? (
        <header className="mb-4 flex items-baseline justify-between gap-4">
          {title !== undefined ? <h3>{title}</h3> : <span />}
          {aside !== undefined ? <div className="text-sm text-muted">{aside}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
