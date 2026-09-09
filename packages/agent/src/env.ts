import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type ChainConfig, chainConfig, isChainName } from '@spirith/core';

// The one place the agent reads process.env. Everything chain-dependent imports this.
export interface AgentEnv {
  readonly chain: ChainConfig;
  readonly rpcUrl: string;
  readonly keeperPrivateKey: `0x${string}` | undefined;
  /** Studio or gateway query URL; the MCP tools and `keeper watch` need it. */
  readonly subgraphUrl: string | undefined;
  readonly graphApiKey: string | undefined;
}

export function loadEnv(env: NodeJS.ProcessEnv = process.env): AgentEnv {
  const name = env.SPIRITH_CHAIN ?? 'sepolia';
  if (!isChainName(name)) throw new Error(`unknown chain: ${name}`);
  const rpcUrl = env.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL is not set');
  const key = env.KEEPER_PRIVATE_KEY;
  return {
    chain: chainConfig(name),
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
