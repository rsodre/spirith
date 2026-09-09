'use client';

import { ConnectKitButton } from 'connectkit';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui';
import { WalletIcon } from '@/icons';
import { cn } from '@/lib/cn';
import { shortAddress } from '@/lib/format';

const NAV = [
  { href: '/', label: 'Scoreboard' },
  { href: '/graveyard', label: 'Graveyard' },
] as const;

// Mounted once in the root layout. The wordmark is the one italic on the page.
export function Header() {
  const pathname = usePathname();
  return (
    <header className="border-line border-b">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-8 px-6 py-4">
        <Link href="/" className="font-title text-2xl italic hover:no-underline">
          Spirith
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'text-muted',
                pathname === item.href && 'text-ink underline underline-offset-4',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <ConnectKitButton.Custom>
            {({ isConnected, isConnecting, show, address }) => (
              <Button variant="secondary" size="sm" onClick={show} loading={isConnecting}>
                <WalletIcon size="sm" />
                {isConnected && address ? shortAddress(address) : 'Connect wallet'}
              </Button>
            )}
          </ConnectKitButton.Custom>
        </div>
      </div>
    </header>
  );
}
