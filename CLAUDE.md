# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this before doing that

| Task | Read first |
| --- | --- |
| Anything: scope, architecture, deadline, decisions | `specs/SPIRITH_HANDOVER.md` |
| Which phase we are in, gates, project structure, commands | `specs/SPIRITH_PLAN.md` |
| Writing or editing CLAUDE.md, specs, README | `spec-discipline` skill |
| Committing, asking the user, handling `_inbox/`, dev ports | `agent-workflow` skill |
| Writing or reviewing Solidity or TypeScript design | `software-design-principles`, `software-design-review` skills |
| Any `.ts`/`.tsx`, Biome, Tailwind, Next.js route or hook | `coding-style`, `nextjs` skills |
| Workspace, packages, builds, tests | `ts-monorepo` skill |
| Contract reads/writes, wallet, addresses, tx toasts | `web3-chain-layer` skill (EVM references only; never Starknet) |

## Skills in force

This repo uses the `rsodre-skills` plugin marketplace (github `rsodre/agent-skills`), enabled in
`.claude/settings.json`: plugins `core`, `web` and `web3`. Their rules are binding over habit.
Consequences that matter here:

- The user commits; the agent does not unless authorised. Check for a dirty tree before big work.
- Important decisions are asked, with a recommendation first, and recorded in the same turn.
  Open questions in the spec block the work that depends on them.
- `_inbox/` is a git-ignored drop folder: read from it, never write to or import from it.
- Once a dev server exists, the agent uses an offset-port `dev:claude` script, never the user's.
- Frontend: TanStack Query for all data access, `bigint` for chain numerics, one address/ABI
  registry, wagmi + viem on the EVM side.
- Update with `/plugin marketplace update rsodre-skills`.

## README rule

`README.md` is for humans, the way this file and `AGENTS.md` are for agents. Keep it brief and
light on technical detail: what Spirith is, the phases, and how to set up and run it. Update the
README as pieces land (a new app, a new command, a deploy step) in the same change that adds
them. No architecture rationale, no agent instructions, no spec content.

## Current state

Pre-implementation, all Day-1 questions resolved (2026-09-05). `specs/SPIRITH_HANDOVER.md` is
the source of truth for scope, architecture, decisions and deadline; `specs/SPIRITH_PLAN.md`
holds the phases, gates and project structure. Read both in full before building anything.
When this file and a spec disagree, the spec wins; update this file.

Planned layout: pnpm workspace with `contracts/` (Foundry), `packages/core` (chain config,
address+ABI registry, pricing and runway math), `packages/subgraph`, `packages/agent` (MCP
server, optimiser, keeper CLI) and `apps/web` (Next.js). Node 23 and pnpm 10 are installed;
Foundry is not yet. There are no build, test or lint commands until Phase 0 lands; the plan's
§3 table lists the ones to add here as they become real.

## What Spirith is

A non-custodial endowment for ENS names, built for ETHGlobal ETHOnline 2026
(hard deadline Sun 2026-09-13 12:00 EDT; aim to submit by 10:00 EDT). A user deposits USDC
into a per-name vault, the deposit earns yield, and *anyone* can call `renew()` to pay the
ENSv2 registrar directly from that vault and receive a capped tip. The name advertises its
own funding status as a resolver record; a dashboard scores liveness across the namespace.

Everything relies on one verified fact: ENSv2 `renew(label, duration, paymentToken, referrer)`
is callable by any account and takes ERC-20 payment. The vault therefore never touches the
name, only money.

## Planned architecture (all on one chain, Sepolia)

- `SpirithVault.sol` — per-name earmarks, patron shares, withdraw-with-notice, permissionless
  `renew()` that approves USDC and calls the ENSv2 ETHRegistrar directly, then writes
  `spirith.funded-until` / `spirith.patrons` to the PermissionedResolver.
- `IYieldAdapter` with `MockYieldAdapter` (the live demo runs on this), `ERC4626Adapter`
  (generic, proven by a Foundry mainnet-fork test), optionally `AaveStableVaultAdapter`.
- Subgraph (The Graph, Subgraph Studio on Sepolia) indexing the ENSv2 registrar and registry
  plus Spirith events: Name, Endowment, Patron, RenewalEvent; liveness is banded at read time.
- A Spirith MCP server (`packages/agent`) over that subgraph, whose real job is optimising
  renewal cadence against the ENSv2 duration-discount curve (not just "watch for expiry").
  Tools: namesAtRisk, runway, optimalCadence, portfolioHealth, rescueProposal. The Graph's
  hosted Subgraph MCP cannot reach Sepolia, so it is not the delivery vehicle.
- Next.js dashboard: namespace scoreboard, name card, endow flow, graveyard view.

## Load-bearing design rules (do not "improve" these away)

- Per-name earmarks, no shared pool. One name's deposit can never pay for another.
- The vault holds the yield shares itself; a patron holds only an internal per-name claim.
  ENSv2 offers no escrow or share concept. The two-exits rule, not a custody trick, is what
  keeps this from being a honeypot (spec §4.1 custody model).
- Exactly two exits for funds: to the ENS registrar as a renewal payment, or back to a patron.
  The renewal path calls the registrar directly, never an intermediary.
- No admin key can move funds. Pause blocks new deposits only; it never blocks a withdrawal
  or a renewal.
- Withdrawals are delayed by a 30-day notice period, never blocked.
- Keeper tip is `min(bps * price, TIP_CAP)`, paid from that name's own earmark.
- Reserve buffer: keep N years of renewals as liquid USDC in the vault; only the excess goes
  to the yield adapter. A name's survival must never depend on an external system being up
  on renewal day. The contract must never depend on the agent.
- Write to ERC-4626, never to a specific yield protocol.
- Always pass Spirith's own address as `referrer` on every renewal.
- No cross-chain hop anywhere on the renewal critical path.
- Honest UI: with a variable yield rate, quote a funded-until *range*, never a single date.
- Hackathon posture: deposit cap (~$100) plus an "unaudited testnet software" banner.

## Verified ENSv2 facts that shape the code (spec §2 has the sources)

Renewals get the multi-year discounts (12.5% / 31.25% / 43.75% at 2 / 3 / 6 years). There is
no renewal window: `renew()` works any time a name is registered or inside its 28-day grace.
Price comes from `registrar.getRenewPrice`. The referrer earns nothing on-chain; an off-chain
DAO program pays mainnet referrers. The live Sepolia beta addresses are in spec §2 and are
verified against the Universal Resolver entry point; the namechain repo holds two other
Sepolia sets that are not live. Resolver records need the owner's `authorizeTextRoles` once.

## Scope discipline

Cut list, in order: Uniswap hook, AaveStableVaultAdapter, multi-patron, subregistry
endowments, on-chain cadence optimiser. Never cut: permissionless `renew()`, per-name
earmark, resolver record, dashboard, demo video.

Locked sponsors: ENS (Best Use of ENSv2) and The Graph (Best AI Tooling). Leave the third
slot empty unless a sponsor would be used with no prize attached. Rejected and not to be
re-proposed (spec §13): Arc, 1inch Aqua, Hedera/World for Phase 1, Aave Stable Vaults for
v1, a Spirith token or DAO treasury, pixel archiving for generative art, pull-model custody
(patron keeps shares and grants an allowance), one escrow clone per name.

Phases 2 (DNS domains) and 3 (file permanence) in the spec are post-hackathon context only.
Do not build toward them now.

## Writing for the submission

README opens with the custody posture ("we custody money, we never custody the name" and
that no admin key can move funds). Use the problem statement in spec §1 verbatim. Lead with
ENSv2's grace-period cut from 90 to 28 days. Cite the 2022 prior art (self-repaying-ens).
State limitations openly: yield is a forecast, testnet yield is theatre.
