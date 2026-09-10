import { mainnet, sepolia } from 'viem/chains';
import type { Chain } from 'viem';

export const ChainName = { Sepolia: 'sepolia', Mainnet: 'mainnet' } as const;
export type ChainName = (typeof ChainName)[keyof typeof ChainName];

export interface ChainConfig {
  readonly name: ChainName;
  readonly chain: Chain;
  readonly chainId: number;
  readonly explorerUrl: string;
}

const CONFIGS: Readonly<Record<ChainName, ChainConfig>> = {
  sepolia: {
    name: 'sepolia',
    chain: sepolia,
    chainId: sepolia.id,
    explorerUrl: 'https://sepolia.etherscan.io',
  },
  mainnet: {
    name: 'mainnet',
    chain: mainnet,
    chainId: mainnet.id,
    explorerUrl: 'https://etherscan.io',
  },
};

export function chainConfig(name: ChainName): ChainConfig {
  return CONFIGS[name];
}

export function isChainName(value: string): value is ChainName {
  return value in CONFIGS;
}

export function chainNameOf(chainId: number): ChainName {
  const found = Object.values(CONFIGS).find(c => c.chainId === chainId);
  if (!found) throw new Error(`no chain config for chain id ${chainId}`);
  return found.name;
}
