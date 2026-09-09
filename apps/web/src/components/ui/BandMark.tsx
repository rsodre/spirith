import type { RiskBand } from '@spirith/core';
import { Icon, type IconName } from '@/icons';
import { cn } from '@/lib/cn';

// The one place a risk band becomes a colour and a word. Verdigris means endowed and alive,
// oxide means dying or dead, amber means the clock is running; nothing else spends them.
const TONE: Readonly<Record<RiskBand, string>> = {
  endowed: 'text-verdigris',
  safe: 'text-muted',
  watch: 'text-amber',
  urgent: 'text-amber',
  critical: 'text-oxide',
  grace: 'text-oxide',
  lapsed: 'text-muted',
};

const WORD: Readonly<Record<RiskBand, string>> = {
  endowed: 'endowed',
  safe: 'safe',
  watch: 'watch',
  urgent: 'urgent',
  critical: 'critical',
  grace: 'in grace',
  lapsed: 'lapsed',
};

const GLYPH: Readonly<Record<RiskBand, IconName>> = {
  endowed: 'live',
  safe: 'live',
  watch: 'live',
  urgent: 'live',
  critical: 'warning',
  grace: 'warning',
  lapsed: 'live',
};

export function bandTone(band: RiskBand): string {
  return TONE[band];
}

export interface BandMarkProps {
  band: RiskBand;
  className?: string;
}

export function BandMark({ band, className }: BandMarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', TONE[band], className)}>
      <Icon name={GLYPH[band]} size="xs" variant={band === 'lapsed' ? 'line' : 'solid'} />
      {WORD[band]}
    </span>
  );
}
