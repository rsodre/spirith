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
2. **DNS domains** (next). The same endowment applied to the web2 domains that NFT metadata
   and immutable contracts still depend on, plus an on-chain fallback when a domain is lost.
3. **Files** (later). Extend the runway to the bytes behind the name, so an artwork, its
   metadata and its address are funded together.

## Status

Phase 1 of the build: the vault core is implemented and tested (endow, notice, withdraw,
per-name earmarks, pause that blocks deposits only). Renewal lands in Phase 2; nothing is
deployed yet.

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
pnpm test:fork:sepolia      # smoke-test the ENSv2 interfaces against live Sepolia
```

Prove that anyone can renew a name they do not own (needs Sepolia ETH on the key; MockUSDC is
minted by the script):

```sh
cd contracts
LABEL=<some-registered-name> forge script script/ProveRenew.s.sol \
  --rpc-url $SEPOLIA_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast
```

To register a test name of your own: run `script/RegisterName.s.sol` with `STEP=commit`, wait a
minute, then again with `STEP=register`.

## Repository

- `contracts/` — Foundry: `SpirithVault`, yield adapters, vendored ENSv2 interfaces, unit,
  fuzz and invariant tests, deploy and proof scripts
- `packages/core` — shared TypeScript: chain config, ENSv2 addresses and ABIs, pricing and
  runway math
- `specs/` — the project handover and the build plan
- `CLAUDE.md`, `AGENTS.md` — guidance for coding agents

## Warning

Unaudited testnet software built for a hackathon. Deposits are capped. Yield is variable and
a perpetual endowment priced on today's rate is an estimate.
