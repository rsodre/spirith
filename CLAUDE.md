# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this before doing that

| Task | Read first |
| --- | --- |
| Anything: scope, architecture, deadline, decisions | `specs/SPIRITH_HANDOVER.md` |
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

## Current state

The repo is pre-implementation. It holds only `specs/SPIRITH_HANDOVER.md`, which is the
source of truth for scope, architecture, decisions and deadline. Read it in full before
building anything. When this file and the spec disagree, the spec wins; update this file.

There are no build, test or lint commands yet. When the stack is scaffolded, add the real
commands here (Foundry: `forge build` / `forge test --match-test <name>` / fork tests need an
RPC URL in `.env`; Next.js app; subgraph `graph codegen` / `graph deploy`).

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
- Subgraph (The Graph) indexing ENSv2 Sepolia plus Spirith events: Name, Endowment, Patron,
  RenewalEvent, LivenessScore.
- Agent over Subgraph MCP whose real job is optimising renewal cadence against the ENSv2
  duration-discount curve (not just "watch for expiry"). Tools: namesAtRisk, runway,
  optimalCadence, portfolioHealth, rescueProposal.
- Next.js dashboard: namespace scoreboard, name card, endow flow, graveyard view.

## Load-bearing design rules (do not "improve" these away)

- Per-name earmarks, no shared pool. One name's deposit can never pay for another.
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

## Open questions to resolve before building past Day 1 (spec §3)

Check `isPaymentToken(USDC)` on the ENSv2 Sepolia deployment; whether multi-year discounts
apply to `renew()` (changes the cadence optimiser and the ~$110 headline); the renewal price
accessor; whether `referrer` earns anything; the Sepolia deployment addresses (get them from
ENS docs or Discord, never guess); and how early before expiry `renew()` may be called.

## Scope discipline

Cut list, in order: Uniswap hook, AaveStableVaultAdapter, multi-patron, subregistry
endowments, on-chain cadence optimiser. Never cut: permissionless `renew()`, per-name
earmark, resolver record, dashboard, demo video.

Locked sponsors: ENS (Best Use of ENSv2) and The Graph (Best AI Tooling). Leave the third
slot empty unless a sponsor would be used with no prize attached. Rejected and not to be
re-proposed (spec §13): Arc, 1inch Aqua, Hedera/World for Phase 1, Aave Stable Vaults for
v1, a Spirith token or DAO treasury, pixel archiving for generative art.

Phases 2 (DNS domains) and 3 (file permanence) in the spec are post-hackathon context only.
Do not build toward them now.

## Writing for the submission

README opens with the custody posture ("we custody money, we never custody the name" and
that no admin key can move funds). Use the problem statement in spec §1 verbatim. Lead with
ENSv2's grace-period cut from 90 to 28 days. Cite the 2022 prior art (self-repaying-ens).
State limitations openly: yield is a forecast, testnet yield is theatre.
