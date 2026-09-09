import { type VariantProps, cva } from 'class-variance-authority';
import type { ComponentType } from 'react';
import { cn } from '@/lib/cn';
import { ICONS, type IconGlyphs, type IconName } from './icons';

// Sizes are the type scale: an icon beside `text-sm` is `size="sm"`.
const icon = cva('shrink-0', {
  variants: {
    size: {
      xs: 'size-3',
      sm: 'size-3.5',
      base: 'size-4',
      lg: 'size-4.5',
      xl: 'size-5',
      '2xl': 'size-6',
    },
  },
  defaultVariants: { size: 'base' },
});

export interface IconProps extends VariantProps<typeof icon> {
  variant?: 'line' | 'solid';
  /** Accessible name; omitted, the mark is hidden from screen readers. */
  label?: string;
  className?: string;
}

export interface DynamicIconProps extends IconProps {
  name: IconName;
}

export function Icon({ name, size, variant = 'line', label, className }: DynamicIconProps) {
  const glyphs: IconGlyphs = ICONS[name];
  const Glyph = glyphs.line;
  return (
    <Glyph
      role={label === undefined ? undefined : 'img'}
      aria-hidden={label === undefined || undefined}
      aria-label={label}
      className={cn(
        icon({ size }),
        variant === 'solid' && glyphs.fillable && 'fill-current',
        className,
      )}
    />
  );
}

export type IconComponent = ComponentType<IconProps>;

/** Bind a registry name into a component; the only way a named export is made. */
export function makeIcon(name: IconName, displayName: string): IconComponent {
  const Bound = (props: IconProps) => <Icon name={name} {...props} />;
  Bound.displayName = displayName;
  return Bound;
}
