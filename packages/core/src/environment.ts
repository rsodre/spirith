import type { Chain } from 'viem';
import { type ChainConfig, type ChainName, chainConfig } from './chains.js';
import { ENS_DEPLOYMENTS, type EnsDeployment } from './ens/addresses.js';
import { ENS_LINKS, type EnsLinks } from './links.js';
import { SPIRITH_DEPLOYMENTS, type SpirithDeployment } from './spirith/registry.js';
import { type SubgraphEndpoint, subgraphEndpoint } from './subgraph/endpoint.js';

// An environment is what one deploy of Spirith runs against: a chain, an ENSv2 contract set,
// Spirith's own contracts on it, and the ENS apps that serve that set. Sepolia carries two
// ENSv2 sets, so the environment, not the chain, is the unit everything is keyed by.
export const EnvName = {
  /** The dedicated ETHOnline 2026 deployment on Sepolia; what the hackathon apps serve. */
  Hackathon: 'hackathon',
  /** The standing ENSv2 beta on Sepolia. */
  Sepolia: 'sepolia',
  /** Ethereum mainnet; ENSv2 is not deployed there yet. */
  Mainnet: 'mainnet',
} as const;
export type EnvName = (typeof EnvName)[keyof typeof EnvName];

export interface Environment {
  readonly name: EnvName;
  /** Prose for the UI, lower case, e.g. "the ENSv2 hackathon deployment on Sepolia". */
  readonly title: string;
  readonly chain: ChainConfig;
  readonly ens: EnsDeployment | undefined;
  readonly spirith: SpirithDeployment | undefined;
  readonly links: EnsLinks;
  /** The Studio subgraph version indexing this environment; none where nothing is deployed. */
  readonly subgraph: SubgraphEndpoint | undefined;
}

const CHAIN_OF: Readonly<Record<EnvName, ChainName>> = {
  hackathon: 'sepolia',
  sepolia: 'sepolia',
  mainnet: 'mainnet',
};

const TITLE_OF: Readonly<Record<EnvName, string>> = {
  hackathon: 'the ENSv2 hackathon deployment on Sepolia',
  sepolia: 'the ENSv2 Sepolia beta',
  mainnet: 'Ethereum mainnet',
};

/** viem and wagmi resolve names through the chain's built-in Universal Resolver; an ENSv2 set
 * has its own, so the chain object an environment hands out points at that one. */
function withUniversalResolver(config: ChainConfig, ens: EnsDeployment | undefined): ChainConfig {
  if (!ens) return config;
  const chain: Chain = {
    ...config.chain,
    contracts: {
      ...config.chain.contracts,
      ensUniversalResolver: { address: ens.universalResolver },
    },
  };
  return { ...config, chain };
}

function build(name: EnvName): Environment {
  const ens = ENS_DEPLOYMENTS[name];
  return {
    name,
    title: TITLE_OF[name],
    chain: withUniversalResolver(chainConfig(CHAIN_OF[name]), ens),
    ens,
    spirith: SPIRITH_DEPLOYMENTS[name],
    links: ENS_LINKS[name],
    subgraph: subgraphEndpoint(name, CHAIN_OF[name]),
  };
}

const ENVIRONMENTS: Readonly<Record<EnvName, Environment>> = {
  hackathon: build('hackathon'),
  sepolia: build('sepolia'),
  mainnet: build('mainnet'),
};

export function environment(name: EnvName): Environment {
  return ENVIRONMENTS[name];
}

export function isEnvName(value: string): value is EnvName {
  return value in ENVIRONMENTS;
}
