import { getDefaultConfig } from 'connectkit';
import { createConfig, http } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { APP_CHAIN, RPC_URL, WALLETCONNECT_PROJECT_ID } from './chain';

// Built once at module scope: connectors reuse a global wallet object and misbehave when
// constructed twice. Injected wallets always; WalletConnect only with a project id.
const connectors = [
  injected(),
  ...(WALLETCONNECT_PROJECT_ID ? [walletConnect({ projectId: WALLETCONNECT_PROJECT_ID })] : []),
];

export const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: [APP_CHAIN.chain],
    transports: { [APP_CHAIN.chainId]: http(RPC_URL) },
    connectors,
    walletConnectProjectId: WALLETCONNECT_PROJECT_ID ?? '',
    appName: 'Spirith',
    appDescription: 'A non-custodial endowment for ENS names.',
    ssr: true,
  }),
);

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
