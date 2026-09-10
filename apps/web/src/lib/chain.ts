import {
  type ChainConfig,
  type ChainName,
  type Environment,
  environment,
  isEnvName,
} from '@spirith/core';
import type { Address, Hex } from 'viem';

// The one place the web app reads its environment. One environment per deploy, chosen by
// profile; everything chain-dependent imports from here.
const name = process.env.NEXT_PUBLIC_ENV ?? 'hackathon';
if (!isEnvName(name)) throw new Error(`NEXT_PUBLIC_ENV: unknown environment ${name}`);

export const APP_ENV: Environment = environment(name);
export const APP_CHAIN: ChainConfig = APP_ENV.chain;

const PUBLIC_RPC: Readonly<Record<ChainName, string>> = {
  sepolia: 'https://ethereum-sepolia-rpc.publicnode.com',
  mainnet: 'https://ethereum-rpc.publicnode.com',
};

/** Browser RPC. viem's built-in Sepolia endpoint refuses unkeyed calls, so the fallback is
 * the public node the rest of the workspace uses. */
export const RPC_URL: string = process.env.NEXT_PUBLIC_RPC_URL || PUBLIC_RPC[APP_CHAIN.name];

/** Without it only injected wallets connect; ConnectKit says so in its own console line. */
export const WALLETCONNECT_PROJECT_ID: string | undefined =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || undefined;

export function explorerAddress(address: Address): string {
  return `${APP_CHAIN.explorerUrl}/address/${address}`;
}

export function explorerTx(hash: Hex): string {
  return `${APP_CHAIN.explorerUrl}/tx/${hash}`;
}
