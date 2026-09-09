'use client';

import { ConnectKitButton } from 'connectkit';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Address } from 'viem';
import { useEnsName } from 'wagmi';
import { Button } from '@/components/ui';
import { useUsdcBalance } from '@/hooks/chain/use-usdc';
import { WalletIcon } from '@/icons';
import { APP_CHAIN } from '@/lib/chain';
import { cn } from '@/lib/cn';
import { formatUsdc, shortAddress } from '@/lib/format';

const NAV = [
  { href: '/endowed', label: 'Endowed' },
  { href: '/expiring', label: 'Expiring' },
  { href: '/graveyard', label: 'Graveyard' },
  { href: '/about', label: 'About' },
  { href: '/roadmap', label: 'Roadmap' },
] as const;

// Mounted once in the root layout. The wordmark is the one italic on the page.
export function Header() {
  const pathname = usePathname();
  return (
    <header className="border-line border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
        <Link href="/" className="font-title text-2xl italic hover:no-underline">
          Spirith
        </Link>
        <nav className="flex flex-wrap items-center gap-5 text-sm">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'text-muted',
                pathname.startsWith(item.href) && 'text-ink underline underline-offset-4',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <WalletButton />
        </div>
      </div>
    </header>
  );
}

// ConnectKit's own modal shows only the native balance, so the test USDC balance, the thing a
// patron actually spends here, sits on the button beside the name.
function WalletButton() {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, isConnecting, show, address, chain }) => (
        <Button variant="secondary" size="sm" onClick={show} loading={isConnecting}>
          <WalletIcon size="sm" />
          {isConnected && address ? (
            <WalletIdentity address={address} chain={chain} />
          ) : (
            'Connect wallet'
          )}
        </Button>
      )}
    </ConnectKitButton.Custom>
  );
}

interface WalletIdentityProps {
  address: Address;
  chain?: { id?: number; name?: string; unsupported?: boolean };
}

/** Primary ENS name through the chain's universal resolver, else the address; then the
 * balance and the network, red when it is not the one the app is deployed on. */
function WalletIdentity({ address, chain }: WalletIdentityProps) {
  const { data: name } = useEnsName({ address });
  const { balance } = useUsdcBalance(address);
  const wrong = chain?.unsupported || (chain?.id !== undefined && chain.id !== APP_CHAIN.chainId);
  return (
    <>
      <span>{name ?? shortAddress(address)}</span>
      {balance !== undefined ? (
        <span className="border-line-strong border-l pl-2 text-muted">
          {formatUsdc(balance)} USDC
        </span>
      ) : null}
      <span className={cn('border-line-strong border-l pl-2', wrong ? 'text-oxide' : 'text-muted')}>
        {wrong
          ? `wrong network: ${chain?.name ?? 'unknown'}`
          : (chain?.name ?? APP_CHAIN.chain.name)}
      </span>
    </>
  );
}
