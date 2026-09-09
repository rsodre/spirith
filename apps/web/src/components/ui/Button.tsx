'use client';

import { type VariantProps, cva } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { LoadingIcon } from '@/icons';
import { cn } from '@/lib/cn';

// The emphasis ladder. `accent` is the one thing on a page the user came to do (endow on a
// name card, renew on a due name); never two on one page. `danger` starts a withdrawal.
// Feedback is motion, not fading: opacity means disabled, so no variant dims on hover.
const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-sm border font-body leading-none whitespace-nowrap transition-transform not-disabled:hover:scale-[1.03] not-disabled:active:scale-[0.97] not-disabled:active:duration-75 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'border-ink bg-ink text-paper',
        secondary: 'border-line-strong bg-panel text-ink',
        ghost: 'border-transparent bg-transparent text-ink underline-offset-4 hover:underline',
        accent: 'border-verdigris bg-verdigris text-paper',
        danger: 'border-oxide bg-transparent text-oxide',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  loading?: boolean;
}

export function Button({
  variant,
  size,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(button({ variant, size }), className)}
      {...rest}
    >
      {loading ? <LoadingIcon size="sm" className="motion-safe:animate-spin" /> : null}
      {children}
    </button>
  );
}
