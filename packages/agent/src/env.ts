import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  type ChainConfig,
  type ChainName,
  type Environment,
  environment,
  isEnvName,
} from '@spirith/core';

// The one place the agent reads process.env. Everything chain-dependent imports this.
export interface AgentEnv {
  /** The environment (chain + ENSv2 set + Spirith deployment), from SPIRITH_ENV. */
  readonly environment: Environment;
  readonly chain: ChainConfig;
  readonly rpcUrl: string;
  readonly keeperPrivateKey: `0x${string}` | undefined;
  /** Studio or gateway query URL; the MCP tools and `keeper watch` need it. */
  readonly subgraphUrl: string | undefined;
  readonly graphApiKey: string | undefined;
}

const RPC_VAR: Readonly<Record<ChainName, string>> = {
  sepolia: 'SEPOLIA_RPC_URL',
  mainnet: 'MAINNET_RPC_URL',
};

export function loadEnv(env: NodeJS.ProcessEnv = process.env): AgentEnv {
  const name = env.SPIRITH_ENV ?? 'hackathon';
  if (!isEnvName(name)) throw new Error(`unknown environment: ${name}`);
  const environ = environment(name);
  const rpcVar = RPC_VAR[environ.chain.name];
  const rpcUrl = env[rpcVar];
  if (!rpcUrl) throw new Error(`${rpcVar} is not set`);
  const key = env.KEEPER_PRIVATE_KEY;
  return {
    environment: environ,
    chain: environ.chain,
    rpcUrl,
    keeperPrivateKey: key?.startsWith('0x') ? (key as `0x${string}`) : undefined,
    subgraphUrl: env.SUBGRAPH_QUERY_URL || undefined,
    graphApiKey: env.GRAPH_API_KEY || undefined,
  };
}

/**
 * Load the nearest `.env` above `from` into process.env without overriding what is already
 * set, so an MCP host that launches the server from the repo root needs no env block.
 */
export function loadDotEnv(from: string = process.cwd()): string | undefined {
  let dir = from;
  for (;;) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
