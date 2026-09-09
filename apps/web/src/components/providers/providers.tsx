'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider } from 'connectkit';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from '@/lib/wagmi';

// Provider order: chain config → the one shared QueryClient (wagmi and the app's own queries
// share it) → wallet UI → toaster. The root layout is a server component and mounts this.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider theme="minimal">
          {children}
          <Toaster position="bottom-right" toastOptions={TOAST_OPTIONS} />
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

const TOAST_OPTIONS = {
  classNames: {
    toast: 'font-body! bg-panel! text-ink! border-line! shadow-panel! rounded-sm!',
    description: 'text-muted!',
  },
};
