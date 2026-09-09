'use client';

import { useModal } from 'connectkit';
import { useCallback, useMemo } from 'react';
import type { Address } from 'viem';
import { useAccount } from 'wagmi';
import { APP_CHAIN } from '@/lib/chain';

export interface Wallet {
  readonly address: Address | undefined;
  readonly isConnected: boolean;
  /** Covers the reconnect on page load, so a returning user never flashes "Connect". */
  readonly isConnecting: boolean;
  readonly wrongChain: boolean;
  readonly connect: () => void;
}

/** The app's one connection API, composing wagmi's account with ConnectKit's modal. */
export function useWallet(): Wallet {
  const { address, isConnected, isConnecting, isReconnecting, chainId } = useAccount();
  const { setOpen } = useModal();
  const connect = useCallback(() => setOpen(true), [setOpen]);
  return useMemo(
    () => ({
      address,
      isConnected,
      isConnecting: isConnecting || isReconnecting,
      wrongChain: isConnected && chainId !== APP_CHAIN.chainId,
      connect,
    }),
    [address, isConnected, isConnecting, isReconnecting, chainId, connect],
  );
}
