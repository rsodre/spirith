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

For a normal five-letter name, roughly $110 deposited once is enough to keep it alive
indefinitely at current rates. That is a forecast, not a guarantee, and the app says so.

## Phases

1. **ENS names** (this hackathon, ETHGlobal ETHOnline 2026). Per-name vaults, permissionless
   renewal, a funding record on the name itself, and a liveness dashboard for the namespace.
2. **DNS domains** (next). The same endowment applied to the web2 domains that NFT metadata
   and immutable contracts still depend on, plus an on-chain fallback when a domain is lost.
3. **Files** (later). Extend the runway to the bytes behind the name, so an artwork, its
   metadata and its address are funded together.

## Status

Pre-implementation. There is nothing to run yet. Setup and run instructions will appear here
as the pieces land.

## Repository

- `specs/` — the project handover and specifications
- `CLAUDE.md`, `AGENTS.md` — guidance for coding agents

## Warning

Unaudited testnet software built for a hackathon. Deposits are capped. Yield is variable and
a perpetual endowment priced on today's rate is an estimate.
