#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { loadDotEnv, loadEnv } from './env.js';
import { renewOnce } from './keeper/renew-once.js';
import { describe, watch } from './keeper/watch.js';

const USAGE = `spirith-keeper once --label <label> [--dry-run]
spirith-keeper watch [--interval <seconds>] [--polls <n>] [--dry-run]
  once   renews <label>.eth from its Spirith earmark when the vault allows it.
  watch  polls the subgraph for endowed names inside the lead window and renews each.
  Reads SEPOLIA_RPC_URL, SUBGRAPH_QUERY_URL (watch) and KEEPER_PRIVATE_KEY; without a key it
  only simulates. (pnpm --filter @spirith/agent keeper once --label <label>)`;

/** The vault's RENEW_LEAD, 30 days; the watcher looks this far ahead. */
const RENEW_LEAD = 30n * 86_400n;

async function main(argv: readonly string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      label: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      interval: { type: 'string', default: '300' },
      polls: { type: 'string' },
    },
  });
  loadDotEnv();
  const command = positionals[0];
  if (command === 'once' && values.label) {
    const env = loadEnv();
    const result = await renewOnce({
      chain: env.chain,
      rpcUrl: env.rpcUrl,
      label: values.label,
      dryRun: values['dry-run'],
      keeperPrivateKey: env.keeperPrivateKey,
    });
    console.log(`${values.label}.eth: ${describe(result)}`);
    return result.status === 'unfunded' ? 1 : 0;
  }
  if (command === 'watch') {
    const env = loadEnv();
    if (!env.subgraphUrl) throw new Error('SUBGRAPH_QUERY_URL is not set');
    const interval = Number(values.interval);
    if (!Number.isFinite(interval) || interval < 5)
      throw new Error('--interval must be >= 5 seconds');
    await watch({
      chain: env.chain,
      rpcUrl: env.rpcUrl,
      dryRun: values['dry-run'],
      keeperPrivateKey: env.keeperPrivateKey,
      subgraph: { url: env.subgraphUrl, apiKey: env.graphApiKey },
      interval,
      renewLead: RENEW_LEAD,
      maxPolls: values.polls === undefined ? undefined : Number(values.polls),
      log: line => console.log(line),
    });
    return 0;
  }
  console.error(USAGE);
  return 2;
}

main(process.argv.slice(2)).then(
  code => process.exit(code),
  error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
