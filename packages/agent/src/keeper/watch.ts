import { GRACE_PERIOD_SECONDS, type SubgraphConfig, fetchNamesAtRisk } from '@spirith/core';
import { type RenewOnceInput, type RenewOnceResult, renewOnce } from './renew-once.js';

export interface WatchInput extends Omit<RenewOnceInput, 'label'> {
  readonly subgraph: SubgraphConfig;
  /** Seconds between polls. */
  readonly interval: number;
  readonly renewLead: bigint;
  readonly log: (line: string) => void;
  /** Stop after this many polls; undefined runs forever. */
  readonly maxPolls?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => bigint;
}

export interface WatchOutcome {
  readonly label: string;
  readonly result: RenewOnceResult | { readonly status: 'error'; readonly message: string };
}

/**
 * Poll the subgraph for endowed names inside the vault's lead window (or in grace) and attempt
 * each one. The vault decides; the keeper only asks. One failing name never stops the others.
 */
export async function watch(input: WatchInput): Promise<readonly WatchOutcome[]> {
  const sleep = input.sleep ?? (ms => new Promise(r => setTimeout(r, ms)));
  const now = input.now ?? (() => BigInt(Math.floor(Date.now() / 1000)));
  const outcomes: WatchOutcome[] = [];
  for (let poll = 0; input.maxPolls === undefined || poll < input.maxPolls; poll++) {
    const names = await fetchNamesAtRisk(input.subgraph, now(), input.renewLead, {
      endowedOnly: true,
      first: 200,
    });
    input.log(`${new Date().toISOString()} ${names.length} endowed name(s) inside the lead window`);
    for (const name of names) {
      if (name.expiry + GRACE_PERIOD_SECONDS <= now()) continue;
      try {
        const result = await renewOnce({ ...input, label: name.label });
        outcomes.push({ label: name.label, result });
        input.log(`  ${name.label}.eth: ${describe(result)}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outcomes.push({ label: name.label, result: { status: 'error', message } });
        input.log(`  ${name.label}.eth: error ${message}`);
      }
    }
    if (input.maxPolls === undefined || poll + 1 < input.maxPolls)
      await sleep(input.interval * 1000);
  }
  return outcomes;
}

export function describe(result: RenewOnceResult): string {
  const days = (s: bigint) => Number(s / 86_400n);
  const usdc = (u: bigint) => (Number(u) / 1e6).toFixed(6);
  switch (result.status) {
    case 'not-due':
      return `not due until ${new Date(Number(result.dueAt) * 1000).toISOString()}`;
    case 'unfunded':
      return `unfunded, ${usdc(result.assets)} USDC earmarked`;
    case 'simulated':
      return `would renew ${days(result.duration)} days at ${usdc(result.price)} USDC, tip ${usdc(result.tip)}`;
    case 'sent':
      return `renewed ${days(result.duration)} days at ${usdc(result.price)} USDC, tip ${usdc(result.tip)}: ${result.hash}`;
  }
}
