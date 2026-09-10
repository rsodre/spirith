# Spirith

**Deposit once. Your ENS name renews itself forever.**

Everything we call permanent online is rented. An Ethereum contract will hold your token
until the sun burns out, but the `.eth` name it answers to expires unless someone pays the bill
every year. Nothing breaks loudly when they forget. The name simply stops resolving.

Spirith is a non-custodial endowment for ENS names. You deposit USDC into a vault dedicated to
one name. The deposit earns yield. When the name comes due, anyone can trigger the renewal:
the vault pays the ENS registrar directly and tips whoever pressed the button. The name then
advertises its own funding status, and a public dashboard shows how healthy the whole
namespace is.

We custody money. We never custody the name. The worst outcome for a user is losing their
deposit. It is structurally impossible for them to lose their identity.

For a normal five-letter name, roughly $110 to $130 deposited once is enough to keep it alive
indefinitely at current rates. That is a forecast, not a guarantee, and the app says so.

## Phases

1. **ENS names** (this hackathon, ETHGlobal ETHOnline 2026). Per-name vaults, permissionless
   renewal, a funding record on the name itself, and a liveness dashboard for the namespace.
2. **Files** (next). The same endowment paying to keep a copy of the bytes an NFT points at,
   so an artwork and its metadata stay reachable without anyone remembering a bill.
3. **DNS domains** (later, for legacy contracts). The same endowment applied to the web2 domains
   that immutable contracts already hard-code, plus an on-chain fallback when a domain is lost.

The post-hackathon proposal is [`specs/SPIRITH_ROADMAP.md`](specs/SPIRITH_ROADMAP.md).

## Status

Phase 6 of the build: the vault is live on the ENSv2 hackathon deployment on Sepolia and has
renewed a name from a stranger's wallet there, the subgraph indexes that namespace, an MCP
server answers questions about it, and a dashboard shows it all. Contracts (verified on
Etherscan; addresses in `packages/core/deployments/hackathon.json`):

| Contract | Address |
|---|---|
| SpirithVault | `0xaC0Fb734bc97Ba542bC3a1974607E8C6FbD42d32` |
| MockYieldAdapter (4% simulated) | `0xb449547B2bE11d8c8e9C1f42a5FC305160dD0832` |

An earlier vault on the standing ENSv2 beta (`packages/core/deployments/sepolia.json`) stays
deployed; the beta's registrar has an older `renew` signature, so new code targets the hackathon
set.

Real yield is proven on an Ethereum mainnet fork rather than on Sepolia, where no lending
market accepts the ENS test tokens: with the vault's `ERC4626Adapter` over Aave v3's USDC token,
50 USDC endowed to a name earned 1.22 USDC in a simulated year (3.6% on the part deployed,
the rest held liquid as the two-year reserve) and then paid a six-year renewal from the
earmark. Run it yourself with `pnpm test:fork:mainnet` and a `MAINNET_RPC_URL`.

A subgraph over the ENSv2 registry and registrar and the vault (`packages/subgraph`) indexes
every `.eth` name on Sepolia and every Spirith endowment; the dashboard and the agent read it.
It is live on Subgraph Studio as
[`spirith-sepolia`](https://thegraph.com/studio/subgraph/spirith-sepolia).

The agent (`packages/agent`) is an MCP server with five tools over that subgraph: names at
risk, a name's runway, the optimal renewal cadence against ENSv2's duration discounts, a
patron's portfolio health, and a rescue proposal with the exact deposit to make. A keeper CLI
in the same package renews any endowed name the vault allows and collects the tip.

The dashboard (`apps/web`) is a Next.js app over the subgraph and the chain. The front page
counts the names dying this month; behind it are the register of expiring names with the value
at risk by price tier, the endowed names with their funded-until ranges, the graveyard, an
about page, the roadmap, a developers page with the addresses and the MCP setup, and a
patron page with your endowments and names, where a new name can be registered on the
ENSv2 registrar. Each name has a card with the endow flow (100 test USDC are minted for a
wallet that is short), a "renew now" button anyone can press once the name is
inside its 30-day lead window, and the owner's one-time step that lets the vault publish the
funding record. It needs a browser wallet on Sepolia; nothing else. Endowments on Sepolia are
in ENS's MockUSDC, the token the beta registrar accepts.

Nothing is audited.

## AI usage

Claude (Anthropic) was used throughout. It took part in the project brainstorm from the original
idea, a sustainable IPFS node, through the branch into DNS domains and then ENS names, and
produced the handover document in `specs/`, constantly updated as the project evolved. It
assisted with the project structure, the scripts, and testing coordination. Design decisions,
scope and what ships are the author's.

The ideation conversation that produced the handover is included verbatim as
[`specs/SPIRITH_IDEATION.md`](specs/SPIRITH_IDEATION.md), for transparency. It is a transcript,
not a spec: where it and the handover disagree, the handover is current.

## Setup

Requirements: Node 23, pnpm 10, [Foundry](https://getfoundry.sh) via `foundryup`. On macOS the
prebuilt Foundry binaries need `brew install libusb`, and `~/.foundry/bin` must be on your `PATH`.

```sh
git clone <repo> spirith && cd spirith
pnpm install                # also installs the Solidity libraries (OpenZeppelin, forge-std)
cp .env.example .env        # fill in SEPOLIA_RPC_URL and, for scripts, DEPLOYER_PRIVATE_KEY
```

## Run

```sh
pnpm check                  # lint, typecheck, unit tests (TypeScript and Solidity)
pnpm test:fork:sepolia      # ENSv2 interfaces and the full demo path against live Sepolia
pnpm test:fork:mainnet      # real yield from Aave on a mainnet fork (needs MAINNET_RPC_URL)
pnpm --filter @spirith/agent keeper once --label <name> --dry-run   # what a keeper would do
pnpm dev                    # the dashboard on http://localhost:3000 (reads the root .env at start; restart after editing it)
```

Spirith runs against one environment at a time: `hackathon`, the dedicated ENSv2 deployment ENS
runs for ETHOnline 2026 with its own ENS app and explorer (default), or `sepolia`, the standing
ENSv2 beta. `SPIRITH_ENV` in `.env` picks it for the scripts, the agent and the
subgraph; `NEXT_PUBLIC_ENV` for the dashboard.

Prove that anyone can renew a name they do not own (needs Sepolia ETH on the key; MockUSDC is
minted by the script):

```sh
cd contracts
LABEL=<some-registered-name> forge script script/ProveRenew.s.sol \
  --rpc-url $SEPOLIA_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast
```

To register a test name of your own: run `script/RegisterName.s.sol` with `STEP=commit`, wait a
minute, then again with `STEP=register`.

Endow and renew through the deployed vault (all scripts take `LABEL=<name>`):

```sh
cd contracts
forge script script/PrepareName.s.sol ...   # name owner: own resolver + let the vault write records
forge script script/Endow.s.sol ...         # any wallet: mint test USDC and endow (AMOUNT, default 50 USDC)
forge script script/Renew.s.sol ...         # any wallet: renew for the optimal duration, collect the tip
forge script script/Deploy.s.sol ...        # deploy the vault for SPIRITH_ENV and write its deployments file
```

Deploy the subgraph to Subgraph Studio (one subgraph per chain, `spirith-sepolia`, a version per
environment; create it at
https://thegraph.com/studio and put its deploy key in `.env`):

```sh
pnpm --filter @spirith/subgraph deploy:studio
```

Deploy the dashboard on Vercel: import the repository with Root Directory set to `apps/web` and
the same variables as `.env` in the project settings. The web package's build script builds
`packages/core` first, so no custom build command is needed.

Ask the agent (Claude Code reads `.mcp.json` in this repository; for Claude Desktop see
`packages/agent/README.md`):

```sh
claude    # then: which endowed names die in the next 30 days and what should each renew for?
```

Run the keeper (simulates without `KEEPER_PRIVATE_KEY`):

```sh
pnpm --filter @spirith/agent keeper once --label spirithbeta --dry-run
pnpm --filter @spirith/agent keeper watch --interval 300
```

## Repository

- `contracts/` — Foundry: `SpirithVault`, yield adapters, vendored ENSv2 interfaces, unit,
  fuzz and invariant tests, deploy and proof scripts
- `packages/core` — shared TypeScript: chain config, ENSv2 and Spirith addresses and ABIs,
  pricing, runway and liveness math, the subgraph query client
- `packages/subgraph` — The Graph subgraph: schema, manifest template and mappings
- `packages/agent` — the keeper CLI, the cadence optimiser and the Spirith MCP server
- `apps/web` — the Next.js dashboard: scoreboard, name cards, endow and renew flows, graveyard
- `specs/` — the project handover and the build plan
- `CLAUDE.md`, `AGENTS.md` — guidance for coding agents

## Warning

Unaudited testnet software built for a hackathon. Deposits are capped. Yield is variable and
a perpetual endowment priced on today's rate is an estimate.
