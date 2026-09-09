import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

// A labelled input. The hint sits under the field and doubles as the error line, so the
// layout never jumps when validation speaks.
export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
  suffix?: string;
}

export function Field({ label, hint, error, suffix, id, className, ...rest }: FieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-sm text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={cn(suffix && 'pr-16', error && 'border-oxide')}
          {...rest}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
            {suffix}
          </span>
        ) : null}
      </div>
      <div className={cn('min-h-5 text-sm', error ? 'text-oxide' : 'text-muted')}>
        {error ?? hint}
      </div>
    </div>
  );
}
