import type { Address } from 'viem';
import { AddressLink } from '@/components/AddressLink';
import { ExternalLink } from '@/components/ExternalLink';
import { ENS, SPIRITH } from '@/hooks/chain/contracts';
import { APP_CHAIN, APP_ENV } from '@/lib/chain';
import {
  ENS_APP_URL,
  ENS_EXPLORER_URL,
  REPO_TREE,
  REPO_URL,
  SUBGRAPH_STUDIO_URL,
} from '@/lib/links';

const SPIRITH_CONTRACTS: readonly { name: string; address: Address; note: string }[] = [
  {
    name: 'SpirithVault',
    address: SPIRITH.spirithVault,
    note: 'per-name earmarks, endow, notice and withdraw, permissionless renew, record write',
  },
  {
    name: 'MockYieldAdapter',
    address: SPIRITH.mockYieldAdapter,
    note: 'simulated 4% on Sepolia; ERC4626Adapter is the mainnet one, proven on a fork',
  },
];

const ENS_CONTRACTS: readonly { name: string; address: Address; note: string }[] = [
  {
    name: 'ETHRegistrar',
    address: ENS.ethRegistrar,
    note: 'renew(), getRenewPrice(), isRenewable()',
  },
  {
    name: 'ETHRegistry',
    address: ENS.ethRegistry,
    note: 'findExpiry(), findOwner(), getResolver()',
  },
  { name: 'MockUSDC', address: ENS.mockUsdc, note: 'the payment token; permissionless mint' },
  {
    name: 'PermissionedResolverImpl',
    address: ENS.permissionedResolverImpl,
    note: 'the resolver that carries spirith.* records',
  },
  {
    name: 'VerifiableFactory',
    address: ENS.verifiableFactory,
    note: 'deploys a resolver proxy per owner',
  },
];

const MCP_TOOLS: readonly { name: string; does: string }[] = [
  {
    name: 'namesAtRisk(days)',
    does: 'names expiring within the window, ranked by band, price tier and time',
  },
  {
    name: 'runway(name)',
    does: 'funded-until range for one name, with the rate assumption stated',
  },
  {
    name: 'optimalCadence(name)',
    does: 'the renewal block with the longest runway against the discount curve',
  },
  {
    name: 'portfolioHealth(address)',
    does: 'every name a patron supports, soonest to run dry first',
  },
  {
    name: 'rescueProposal(name)',
    does: 'how much to endow, what it buys, and the exact approve and endow calls',
  },
];

const MCP_JSON = `{
  "mcpServers": {
    "spirith": {
      "command": "pnpm",
      "args": ["--silent", "--filter", "@spirith/agent", "mcp"]
    }
  }
}`;

// Where the code is and how to talk to it: the repository, the contracts on Sepolia, the
// subgraph, the MCP server and the keeper. Everything here is derived from core's registries.
export function DevelopersPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <article className="max-w-3xl">
        <h1 className="text-5xl md:text-6xl">Developers</h1>
        <p className="mt-5 font-title text-xl leading-relaxed text-muted">
          Open source monorepo: Foundry contracts, a shared TypeScript core, the subgraph, the agent
          and this dashboard.
        </p>

        <h2>Source code</h2>
        <p>
          <ExternalLink href={REPO_URL}>{REPO_URL.replace('https://', '')}</ExternalLink>, a pnpm
          workspace. The parts:
        </p>
        <ul>
          <li>
            <ExternalLink href={`${REPO_TREE}/contracts`}>contracts/</ExternalLink>: the vault, the
            yield adapters, the vendored ENSv2 interfaces, unit, fuzz and invariant tests, and the
            deploy and proof scripts.
          </li>
          <li>
            <ExternalLink href={`${REPO_TREE}/packages/core`}>packages/core</ExternalLink>: chain
            config, the address and ABI registry, pricing, runway and liveness math, the subgraph
            client.
          </li>
          <li>
            <ExternalLink href={`${REPO_TREE}/packages/subgraph`}>packages/subgraph</ExternalLink>:
            schema, manifest template and mappings.
          </li>
          <li>
            <ExternalLink href={`${REPO_TREE}/packages/agent`}>packages/agent</ExternalLink>: the
            MCP server, the cadence optimiser and the keeper CLI.
          </li>
          <li>
            <ExternalLink href={`${REPO_TREE}/apps/web`}>apps/web</ExternalLink>: this dashboard.
          </li>
        </ul>

        <h2>Contracts on {APP_CHAIN.chain.name}</h2>
        <p>
          Verified on Etherscan. The vault never holds a name; it holds USDC earmarked per name and
          has exactly two exits for it.
        </p>
        <ContractTable rows={SPIRITH_CONTRACTS} />
        <p>
          The contracts of {APP_ENV.title} the vault calls, verified against that deployment's
          universal resolver entry point. The set is served by its own{' '}
          <ExternalLink href={ENS_APP_URL}>ENS app</ExternalLink> and{' '}
          <ExternalLink href={ENS_EXPLORER_URL}>explorer</ExternalLink>; the environment is chosen
          by <code>NEXT_PUBLIC_ENV</code>.
        </p>
        <ContractTable rows={ENS_CONTRACTS} />

        <h2>Subgraph</h2>
        <p>
          <ExternalLink href={SUBGRAPH_STUDIO_URL}>spirith-{APP_CHAIN.name}</ExternalLink> on
          Subgraph Studio indexes every <code>.eth</code> name on the registry of {APP_ENV.title}{' '}
          and every Spirith event: <code>Name</code>, <code>Endowment</code>, <code>Patron</code>,{' '}
          <code>RenewalEvent</code> and a <code>Namespace</code> row of running totals. Nothing
          time-dependent is stored; risk bands and funded-until are computed at read time.
        </p>

        <h2>MCP server</h2>
        <p>
          The agent is an MCP server over that subgraph and the vault, with five tools. Its job is
          not to watch for expiry but to optimise renewal cadence against ENSv2's duration
          discounts.
        </p>
        <ul>
          {MCP_TOOLS.map(t => (
            <li key={t.name}>
              <code>{t.name}</code>: {t.does}
            </li>
          ))}
        </ul>
        <p>
          Clone the repository, run <code>pnpm install</code>, put a Sepolia RPC URL in{' '}
          <code>.env</code>, and Claude Code picks the server up from the repository's{' '}
          <code>.mcp.json</code>:
        </p>
        <pre className="overflow-x-auto rounded-sm border border-line bg-panel p-4 text-sm">
          <code>{MCP_JSON}</code>
        </pre>
        <p>
          Then ask:{' '}
          <em>which endowed names die in the next 30 days and what should each renew for?</em>{' '}
          Claude Desktop needs the built server; the package README has that form.
        </p>

        <h2>Keeper</h2>
        <p>
          A CLI in the same package asks the vault whether a name may be renewed and for how long,
          simulates, sends, and collects the tip. Without a key it only simulates.
        </p>
        <pre className="overflow-x-auto rounded-sm border border-line bg-panel p-4 text-sm">
          <code>
            {`pnpm --filter @spirith/agent keeper once --label <name> --dry-run
pnpm --filter @spirith/agent keeper watch --interval 300`}
          </code>
        </pre>
      </article>
    </main>
  );
}

function ContractTable({
  rows,
}: {
  rows: readonly { name: string; address: Address; note: string }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="text-sm">
        <thead>
          <tr>
            <th>Contract</th>
            <th>Address</th>
            <th>Does</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.name}>
              <td className="whitespace-nowrap">{r.name}</td>
              <td className="whitespace-nowrap">
                <AddressLink address={r.address} />
              </td>
              <td>{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
