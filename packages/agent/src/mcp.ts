#!/usr/bin/env node
// Spirith MCP server over stdio (HANDOVER §6). Five tools, each a pure function in tools/ over
// the subgraph and the vault; this file only maps them onto the protocol.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { type Address, isAddress } from 'viem';
import { z } from 'zod';
import { viemChainReader } from './chain.js';
import { loadDotEnv, loadEnv } from './env.js';
import { toJson, toJsonObject } from './json.js';
import {
  type ToolContext,
  type ToolResult,
  namesAtRisk,
  optimalCadence,
  portfolioHealth,
  rescueProposal,
  runway,
} from './tools/index.js';

const LABEL = z
  .string()
  .min(3)
  .transform(s =>
    s
      .trim()
      .toLowerCase()
      .replace(/\.eth$/, ''),
  )
  .describe('The .eth name, with or without the suffix, e.g. "spirithbeta" or "spirithbeta.eth"');

function present<T>(result: ToolResult<T>) {
  return {
    content: [{ type: 'text' as const, text: `${result.summary}\n\n${toJson(result.data, 2)}` }],
    structuredContent: { summary: result.summary, ...toJsonObject(result.data) },
  };
}

export function buildServer(ctx: ToolContext): McpServer {
  const server = new McpServer({ name: 'spirith', version: '0.1.0' });

  server.registerTool(
    'namesAtRisk',
    {
      title: 'Names at risk',
      description:
        'ENS names on Sepolia expiring within N days, worst first: lapsed, in grace, critical, urgent, watch. Says which are endowed by Spirith and the yearly renewal value at risk.',
      inputSchema: z.object({
        days: z.number().int().min(1).max(3650).default(30),
        limit: z.number().int().min(1).max(200).default(20),
        endowedOnly: z.boolean().default(false).describe('Only names with a Spirith endowment'),
      }),
    },
    async args => present(await namesAtRisk(ctx, args)),
  );

  server.registerTool(
    'runway',
    {
      title: 'Runway',
      description:
        'Projected funded-until range for one name from its Spirith earmark, with the yield assumption stated, plus expiry, band, patrons and last renewal.',
      inputSchema: z.object({ name: LABEL }),
    },
    async ({ name }) => present(await runway(ctx, name)),
  );

  server.registerTool(
    'optimalCadence',
    {
      title: 'Optimal cadence',
      description:
        'Which renewal block (1, 2, 3 or 6 years) gives a name the longest runway against the ENSv2 duration discounts, and why; optionally for a what-if balance.',
      inputSchema: z.object({
        name: LABEL,
        assets: z
          .string()
          .regex(/^\d+$/)
          .optional()
          .describe('What-if earmark in USDC base units (6 decimals); defaults to the live one'),
      }),
    },
    async ({ name, assets }) =>
      present(
        await optimalCadence(ctx, { label: name, assets: assets ? BigInt(assets) : undefined }),
      ),
  );

  server.registerTool(
    'portfolioHealth',
    {
      title: 'Portfolio health',
      description:
        'Every name an address endows, soonest to run dry first: which of my names dies first?',
      inputSchema: z.object({
        address: z
          .string()
          .refine(isAddress, 'not an EVM address')
          .describe('Patron address, 0x-prefixed'),
      }),
    },
    async ({ address }) => present(await portfolioHealth(ctx, address as Address)),
  );

  server.registerTool(
    'rescueProposal',
    {
      title: 'Rescue proposal',
      description:
        'How much USDC a name needs to be safe, what that buys, and the exact approve + endow calls anyone can make.',
      inputSchema: z.object({ name: LABEL }),
    },
    async ({ name }) => present(await rescueProposal(ctx, name)),
  );

  return server;
}

async function main(): Promise<void> {
  loadDotEnv();
  const env = loadEnv();
  if (!env.subgraphUrl)
    throw new Error(
      `no subgraph for the ${env.environment.name} environment; set SUBGRAPH_QUERY_URL`,
    );
  const ctx: ToolContext = {
    subgraph: { url: env.subgraphUrl, apiKey: env.graphApiKey },
    chain: viemChainReader(env),
    now: () => BigInt(Math.floor(Date.now() / 1000)),
  };
  await buildServer(ctx).connect(new StdioServerTransport());
}

if (process.argv[1] && /mcp\.(ts|js)$/.test(process.argv[1])) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
