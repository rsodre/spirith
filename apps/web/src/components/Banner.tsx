import { WarningIcon } from '@/icons';

// The hackathon posture, stated on every page (spec §4.1).
export function Banner() {
  return (
    <div className="bg-amber-wash text-ink">
      <p className="mx-auto flex w-full max-w-6xl items-center gap-2 px-6 py-2 text-sm">
        <WarningIcon size="sm" className="text-amber" />
        Unaudited testnet software. Deposits are capped at 100 test USDC, and yield on testnet is
        simulated.
      </p>
    </div>
  );
}
