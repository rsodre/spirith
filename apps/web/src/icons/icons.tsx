import {
  Check,
  Circle,
  ExternalLink,
  LoaderCircle,
  type LucideIcon,
  TriangleAlert,
  Wallet,
} from 'lucide-react';

export type IconGlyphs = {
  /** The outline drawing; the only drawing there is. */
  line: LucideIcon;
  /** Whether painting that outline is a mark in its own right (`variant="solid"`). */
  fillable?: true;
};

// One entry per MEANING. A name says what the icon means, never what it draws.
export const ICONS = {
  // state
  live: { line: Circle, fillable: true },
  done: { line: Check },
  warning: { line: TriangleAlert },
  loading: { line: LoaderCircle },
  // navigation
  external: { line: ExternalLink },
  wallet: { line: Wallet },
} as const satisfies Record<string, IconGlyphs>;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];
