# Spirith — Build Plan (Phase 1, Sepolia)

Phases, gates and project structure for the ETHOnline 2026 build. Facts and design live in
`SPIRITH_HANDOVER.md` (referenced as `→ HANDOVER §n`); this file restates none of them. Tick a
finished phase `✅` on its heading, `☑️` when it landed with something outstanding (named in a
sub-heading). Commands move into `CLAUDE.md` the day they exist.

Hard deadline Sun 2026-09-13 12:00 EDT. Phases have no dates; only the submission has one.

---

## 0. Decisions taken in this plan

Each is reversible today and expensive later. Veto now or they stand.

| Decision | Choice | Reason |
|---|---|---|
| Workspace | pnpm workspace, `apps/*` + `packages/*`, Foundry project at `contracts/` as a workspace member with a `package.json` of proxy scripts | One `pnpm check` gates Solidity and TypeScript alike; `contracts/` at root keeps `forge` paths short |
| Solidity deps | `@openzeppelin/contracts` from npm, `forge-std` from `github:foundry-rs/forge-std#<tag>`, both as `contracts/package.json` devDependencies with remappings into `node_modules` | One package manager for the whole repo; no submodules to forget on clone |
| ENSv2 interfaces | Vendor the four interfaces Spirith calls (`IETHRenewer`, `IPermissionedRegistry` read subset, `IRentPriceOracle` discount read, `ITextResolver`) into `contracts/src/interfaces/ens/`, verbatim with licence and source URL | `forge install ensdomains/contracts-v2` drags eight submodules and a Yul build; we need four files and stable compile times |
| Vault asset on Sepolia | ENS `MockUSDC` (constructor parameter, mainnet passes real USDC) | Permissionless `mint` gives the demo a "get test USDC" button; Circle's faucet is rate-limited |
| Yield on Sepolia | `MockYieldAdapter` only; `ERC4626Adapter` proven by mainnet-fork test | → HANDOVER §4.2: no Sepolia market accepts the ENS payment tokens |
| Agent | Spirith MCP server in `packages/agent`, stdio transport, querying the Studio endpoint | → HANDOVER §6: hosted Subgraph MCP cannot reach Sepolia |
| Keeper | TypeScript CLI in `packages/agent` (`spirith-keeper`), viem, reads the subgraph, sends `renew()` | Shares the subgraph client and cadence code with the MCP tools; Foundry scripts stay deploy-only |
| Address registry | Foundry deploy script writes `packages/core/deployments/sepolia.json`; `packages/core` exports `{address, abi}` per contract from that file plus `contracts/out` | One source for web, agent, keeper and subgraph manifest → `web3-chain-layer` |
| Frontend stack | Next.js 15 App Router, React 19, Tailwind 4, Biome, wagmi 2 + viem 2 + ConnectKit, TanStack Query | Skill defaults (`nextjs`, `coding-style`, `web3-chain-layer`) |
| Subgraph | One subgraph, three data sources (ETHRegistrar, ETHRegistry, SpirithVault), deployed to Subgraph Studio on `sepolia` | Studio is the only option for Sepolia; three sources keep name and endowment in one schema |
| Liveness score | Stored as inputs (expiry, tier, endowed, runway) and banded at read time in `packages/core` | A time-dependent field in an entity is stale the block after it is written |
| Dev ports | web `3000` user / `3100` agent | → `agent-workflow` |

---

## 1. Project structure

```
spirith/
├── CLAUDE.md  AGENTS.md  README.md
├── package.json              private; proxy scripts; packageManager; engines
├── pnpm-workspace.yaml       packages: apps/*, packages/*, contracts; catalog:
├── biome.jsonc  tsconfig.base.json  .nvmrc  .env.example
├── specs/
│   ├── SPIRITH_HANDOVER.md   facts, design, decisions (source of truth)
│   └── SPIRITH_PLAN.md       this file
├── contracts/                Foundry
│   ├── foundry.toml  remappings.txt  package.json (build/test/deploy proxies)
│   ├── src/
│   │   ├── SpirithVault.sol
│   │   ├── adapters/ IYieldAdapter.sol  MockYieldAdapter.sol  ERC4626Adapter.sol
│   │   ├── libraries/ Cadence.sol (on-chain heuristic)  NameCoder.sol (namehash + dns-encode)
│   │   └── interfaces/ens/ IETHRenewer.sol  IPermissionedRegistryRead.sol  IRentPriceOracleRead.sol  ITextResolver.sol
│   ├── test/
│   │   ├── SpirithVault.t.sol            unit: endow / notice / withdraw / earmarks / cap / pause
│   │   ├── Renew.t.sol                   renew path against MockRegistrar + Sepolia fork
│   │   ├── invariants/TwoExits.t.sol     token only ever leaves to registrar or patron
│   │   ├── ERC4626Adapter.fork.t.sol     mainnet fork, waEthUSDC
│   │   └── mocks/ MockRegistrar.sol  MockERC20.sol  MockResolver.sol
│   └── script/ Deploy.s.sol  ProveRenew.s.sol  Config.s.sol
├── packages/
│   ├── core/                 @spirith/core: chain config, address+ABI registry, pricing/discount/runway math (pure, vitest)
│   ├── subgraph/             @spirith/subgraph: schema.graphql, subgraph.template.yaml, src/ mappings; abis/, subgraph.yaml and src/config.ts rendered from core by scripts/prepare.mjs
│   └── agent/                @spirith/agent: MCP server (5 tools), cadence optimiser, subgraph client, keeper CLI
├── apps/
│   └── web/                  @spirith/web: Next.js dashboard
│       └── src/ app/ components/{pages,providers,ui}/ hooks/{queries,mutations,chain}/ lib/ types/
└── _inbox/                   git-ignored drop folder
```

Package import rules (guardrails once the code exists):

- `core` imports nothing from the workspace. Zero runtime deps beyond `viem`.
- `agent` imports `core`. Never imports `web`. Must run under Node with no browser API.
- `web` imports `core`. Chain reads and writes go through wagmi hooks in `hooks/chain/`, never through API routes.
- `subgraph` copies ABIs from `core` at build time; nothing imports `subgraph`.
- `contracts` is consumed only through its `out/` artifacts and `deployments/*.json`.

Environment (`.env.example`, one profile per deploy):

```
SEPOLIA_RPC_URL=           MAINNET_RPC_URL=   (fork test only)
DEPLOYER_PRIVATE_KEY=      ETHERSCAN_API_KEY=
GRAPH_DEPLOY_KEY=          SUBGRAPH_QUERY_URL=   GRAPH_API_KEY=
NEXT_PUBLIC_CHAIN=sepolia  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
```

---

## 2. Phases

Each phase ends with a gate. A gate is observed, not believed: a passing command, a transaction
hash, or a URL. Cut-list order when time runs short → HANDOVER §9.4.

### Phase 0 ✅ — Toolchain, scaffold, proof of path

1. Install Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`). Node 23 and pnpm 10 are present.
2. Root: `pnpm-workspace.yaml` with catalog (viem, wagmi, @tanstack/react-query, next, react, tailwindcss, biome, vitest, typescript), `biome.jsonc` from the `coding-style` reference, `tsconfig.base.json`, `.nvmrc`, `.env.example`, root scripts `build`, `check`, `dev:claude`, `test`.
3. `contracts/`: `forge init` without template files, OpenZeppelin v5 + forge-std, vendored ENS interfaces, `Config.s.sol` holding the Sepolia addresses → HANDOVER §2.
4. Register two test names on https://manager.ens.dev with MockUSDC (mint from the token, approve, register 28 days so one expires during the hackathon window). Record labels and expiries here.
5. `ProveRenew.s.sol`: from a plain EOA that does **not** own the name, approve MockUSDC and call `registrar.renew(label, 1 year, MockUSDC, referrer)`. This is the whole thesis in one transaction.
6. `packages/core`: chain config, address registry seeded from the ENS table, pricing math (`basePrice`, `applyDiscount`, `renewPrice`), runway math with a rate range. Vitest pins the on-chain numbers: `renewPrice('vitalik', 1y) = 8_000_021n` at the sibling oracle's ratio, `applyDiscount` at 2/3/6 y.
7. README: setup and run instructions for what now exists.

**Gate:** `pnpm check` green; renewal tx hash from a non-owner recorded below; `forge test` runs.

Landed 2026-09-05: steps 1–3, 6 and 7. `pnpm check` is green (Biome, `forge fmt`, `tsc`, 16 vitest
pins, 8 Foundry tests of which 5 run against live Sepolia through the vendored interfaces).
Toolchain notes: Foundry is installed with `foundryup` (1.8.1); Homebrew's `foundry` formula has
no bottle for macOS 13 and compiles cmake and Foundry from source, so it is not used. The prebuilt
binary links Homebrew's `libusb` (`brew install libusb`). `~/.foundry/bin` must be on `PATH`.
Solidity dependencies come through pnpm: `@openzeppelin/contracts` from npm and `forge-std` from
its GitHub tag (foundry-rs publishes no npm package); no git submodules.

Proof of path, 2026-09-06 on Sepolia. Test names registered by the deployer key
`0x62d48EA396a8BD7A5627BbAB5969DD45DB2b42c4` for the minimum 28 days (613,701 MockUSDC each):
`spirithalpha.eth` and `spirithbeta.eth`, both on `PublicResolverV2`, expiry 2026-10-04.
Then the keeper key `0xF137c0A0423D16d80FF3b106b979D3d90118E5B7`, which owns neither, renewed
`spirithalpha.eth` for one year at 8.000021 MockUSDC:
tx `0x2828d07e01396b681c8a9cb978a9eeb96c234fdff89a1e2e942fca3ac5a62afb`, expiry now 2027-10-04.
Both keys live in the git-ignored `.env` (`DEPLOYER_PRIVATE_KEY`, `KEEPER_PRIVATE_KEY`).
`spirithbeta.eth` stays at its 28-day expiry, inside the 30-day renew lead from day one, which
is the Phase 2 demo path; a PermissionedResolver name for the record write is registered in
Phase 2 through manager.ens.dev.

### Phase 1 ✅ — Vault core

`SpirithVault.sol` per HANDOVER §4.1, with the custody model and two-exits invariant as written.

- Storage per name: `reserve` (liquid USDC), `adapterShares`, `totalShares`; per patron `shares`, `noticeAt`, `noticeShares`.
- `endow(label, amount)`: cap per name (100 USDC), mints internal shares at current assets-per-share, tops the reserve to `RESERVE_YEARS × renewPrice(1y)`, deposits the excess to the adapter. Reverts if the name is not `REGISTERED` or in grace.
- `requestWithdraw(label, shares)` / `executeWithdraw(label)` after `NOTICE_PERIOD` (30 days). Pays from reserve then adapter. Pause never blocks it.
- `pause()` / `unpause()` behind OpenZeppelin `Ownable2Step` + `Pausable`; the owner can do nothing else. Consider renouncing after deploy and say so in the README either way.
- Events: `Endowed`, `WithdrawRequested`, `Withdrawn`, `Paused`.
- Tests: unit suite for every branch; invariant suite proving USDC balance of the vault only decreases by `Withdrawn` to the patron of record (Phase 2 adds the registrar leg); fuzz on share math with 6-decimal amounts.

**Gate:** `forge test` green including invariants with 4096 runs; no function can move tokens to a third address (grep the ABI, then the test).

Landed 2026-09-06. `SpirithVault.sol`, `IYieldAdapter.sol`, `MockYieldAdapter.sol`; 19 unit and
fuzz tests, 5 invariants (conservation to patrons only, strangers hold nothing, every token
earmarked, per-name solvency, no standing allowance) green at 4096 runs / 131,072 calls / 0
reverts. Admin is OpenZeppelin `Ownable2Step` + `Pausable` (decided 2026-09-07): state-changing
ABI is `endow`, `requestWithdraw`, `executeWithdraw`, `pause`, `unpause`, `transferOwnership`,
`acceptOwnership`, `renounceOwnership` (overridden to lift a pause first); the single outbound
`safeTransfer` goes to `msg.sender` in `executeWithdraw`.
Deviations from the plan text, all recorded in HANDOVER §4.1–4.2: the adapter interface gained
`asset`, `withdraw`, `sharesOf`, `convertToShares` and reports a rate range; the last patron out
takes the rounding dust; `REGISTRY` is not yet a constructor argument (Phase 2 adds it).

### Phase 2 ✅ — Renewal path, live on Sepolia

- `renew(label, duration)` per HANDOVER §4.1 steps 1–6, tip `min(1% × price, 1 USDC)`, `RENEW_LEAD` 30 days, best-effort `setText` with a gas stipend.
- `Cadence.sol`: `optimalDuration(label)` returns the longest of {6y, 3y, 2y, 1y} whose price leaves the reserve floor intact, else the longest affordable, else revert `Unfunded`.
- `runwayOf(label)` returns `(fundedUntilLow, fundedUntilHigh, assets, optimalDuration)` using a rate range supplied by the adapter.
- `Renew.t.sol`: against `MockRegistrar` for branches, then a **Sepolia fork test** against the live registrar and a test name from Phase 0 (`forge test --fork-url $SEPOLIA_RPC_URL --match-contract RenewFork`).
- `Deploy.s.sol` writes `packages/core/deployments/sepolia.json`. Deploy `MockYieldAdapter` + `SpirithVault`. Verify on Etherscan.
- From the deployer's second account: mint MockUSDC, `endow` a test name, `authorizeTextRoles` on that name's resolver for both keys, wait for the lead window or use the heuristic path, call `renew` from a third account, read the text record back through `explorer.ens.dev`.
- Extend the invariant suite: tokens leave only to `BENEFICIARY` via the registrar or to the patron.

**Gate:** Sepolia tx hashes for `endow`, `renew` (by a non-owner), and a visible `spirith.funded-until` record; `forge test` green with the fork test.

Landed 2026-09-07. Deployed on Sepolia (block 11655091, recorded in
`packages/core/deployments/sepolia.json`): `SpirithVault`
`0x82c2f76c78CeBD8D9767F35f35de332d1991EEa0`, `MockYieldAdapter` (4%)
`0x97E4218ECa394b7804Ed1514b947Bd0d75a26C34`, owner = deployer, not yet renounced, both
Etherscan-verified 2026-09-07 (a natspec edit after deploy had to be reverted to match the
bytecode metadata; verify before editing source next time). Live demo on `spirithbeta.eth`:
`PrepareName` deployed PermissionedResolver `0xd16bCF2279d60e393b9Ddf0296Ee445a769498Cf`, set
it on the registry and authorised the vault for both keys; `Endow` 50 USDC
(`0x860ec1099c6f1156d972b1eb67af4f94938b8fc4bf98765538b30ac086af0902`); keeper `Renew` for the
six-year block at 27.000071 USDC with a 0.27 tip
(`0xd5d71a027adbd229668337595a854b2e0cdca0b24f1e95db7674dc0c28acdb34`), expiry 2026-10-04 →
2032-10-03, `spirith.funded-until = 2074952700`. Tests: 48 local (23 renewal, 21 vault, 3
selector pins, 5 invariants at 4096 runs / 0 reverts) plus 7 on a Sepolia fork including the
full demo path. Decisions recorded in HANDOVER §4.1 (trigger = lead window and exact optimal
duration; three exit ledgers) and §4.3 (`PrepareName` flow). `packages/core` now exports
`spirithContract` and `SPIRITH_DEPLOYMENTS` from the deploy JSON and refreshed ABIs.

### Phase 3 ✅ — Real yield proof

- `ERC4626Adapter.sol`: `deposit` / `redeem` / `convertToAssets` / `rateRange()` over any ERC-4626; `rateRange` reads a configured `[lowBps, highBps]` because ERC-4626 exposes no rate.
- `ERC4626Adapter.fork.t.sol` on a mainnet fork: deal USDC, endow, `vm.warp` a year, assert `convertToAssets` grew, renew against `MockRegistrar`. Print the accrued yield in the test log for the README.

**Gate:** `forge test --fork-url $MAINNET_RPC_URL --match-contract ERC4626AdapterFork` green; the yield number is in the README.

Landed 2026-09-07. `ERC4626Adapter.sol` (per-caller ledger over any ERC-4626, rate range set at
deploy) and `test/ERC4626AdapterFork.t.sol` against Aave v3's `waEthUSDC` on an Ethereum mainnet
fork at block 25,927,844 (`MAINNET_RPC_URL` in `.env`, the public node): 50 USDC
endowed, 16.000042 kept liquid, 33.999958 deposited in Aave; after a one-year warp the earmark
read 51.224465 USDC, i.e. **1.224466 USDC of real interest, 3.60% on the deployed part**; the
keeper then bought the six-year block for 27.000071 USDC from the earmark. A second test
withdraws principal plus a month of yield and leaves nothing in the adapter. The keeper CLI
planned here moved to Phase 5, next to the subgraph client it will use.

### Phase 4 ✅ — Subgraph

- Schema per HANDOVER §5: `Name`, `Endowment`, `Patron`, `RenewalEvent`, plus `Namespace` singleton with running totals (names, endowed, expiring-28d, graveyard count).
- Data sources from the ETHRegistrar's first block (find via explorer.ens.dev or a binary search on `getCode`): `ETHRegistrar.NameRegistered/NameRenewed`, `ETHRegistry.LabelRegistered/ExpiryUpdated/TransferSingle/ResolverUpdated/LabelUnregistered`, `SpirithVault.*`. Key `Name` by labelhash; tier from label length.
- `graph codegen && graph build && graph deploy --studio spirith-sepolia`.
- `packages/core` gets the typed query client and the read-time liveness banding (`risk = f(daysToExpiry, endowed, runway)`).

**Gate:** Studio endpoint answers `names(where: {expiry_lt: now + 28d}, orderBy: expiry)` and `endowments` with the Phase 2 data; URL and API key in `.env`.

Landed 2026-09-08. `packages/subgraph`: `schema.graphql` (`Namespace`, `Name`,
`Token`, `Endowment`, `Patron`, `Patronage`, `EndowmentEvent`, `RenewalEvent`; HANDOVER §5 has
the as-built shape), `subgraph.template.yaml` rendered to `subgraph.yaml` by `scripts/prepare.mjs`
together with `abis/` and `src/config.ts`, all from `@spirith/core`; three mappings
(`src/registry.ts`, `src/registrar.ts`, `src/vault.ts`). Start blocks from Etherscan: ETHRegistry
11383897, ETHRegistrar 11383914 (both 2026-07-30), vault 11655091. `graph build` runs inside
`pnpm check` (`check-types` of the package). `packages/core` gained `subgraph/` (fetch-based
client, typed queries with bigint parsing) and `liveness.ts` (read-time bands); 11 new vitest
pins. Graph CLI 0.98.1 / graph-ts 0.38.2 in the catalog.

Deployed to Subgraph Studio 2026-09-08 as `spirith-sepolia` v0.1.0, page
https://thegraph.com/studio/subgraph/spirith-sepolia, query endpoint
`https://api.studio.thegraph.com/query/1758987/spirith-sepolia/v0.1.0` (in `.env` as
`SUBGRAPH_QUERY_URL`; the Studio endpoint takes no API key). The deploy script is `deploy:studio`
because `pnpm deploy` is a pnpm built-in. Bump `config.versionLabel` in the package manifest
before redeploying a schema change; Studio keeps one endpoint per version label. Gate observed
the same day: the endpoint reached chain head (block 11664733) with no indexing errors in about
25 minutes, holding 171,010 names and 6,057 renewals; `endowments` returns spirithbeta with
50 USDC contributed, 27.270071 spent, 1 patron, `recordWritten: true`, and `renewalEvents` the
keeper's six-year renewal with the vault as referrer.

### Phase 5 — Agent: MCP server + optimiser

- `packages/agent/src/optimiser/`: pure functions. `optimalCadence({assets, rateLowBps, rateHighBps, tier, expiry, discountPoints, reserveYears})` simulates renew-1y-forever versus 2/3/6-year blocks over a horizon and returns the strategy with the longest runway at the low rate, with a one-paragraph explanation string. Vitest with the on-chain discount points.
- MCP server (`@modelcontextprotocol/sdk`, stdio): `namesAtRisk(days)`, `runway(name)`, `optimalCadence(name)`, `portfolioHealth(address)`, `rescueProposal(name)`. Each tool queries the subgraph through `core`, runs the optimiser, and returns structured JSON plus a sentence a human can read.
- `.mcp.json` example for Claude Code and Claude Desktop in the package README; a recorded transcript of three questions goes in the submission.
- Keeper CLI in the same package: `spirith-keeper once --label x` reads the vault, simulates and sends `renew`; `watch` polls `namesAtRisk` and renews when the vault's trigger holds.

**Gate:** From a fresh Claude Code session with the server configured, "which endowed names die in the next 30 days and what should each renew for?" returns live Sepolia data with cadences; `pnpm --filter @spirith/agent test` green.

### Phase 6 — Dashboard

Pages, each a folder under `components/pages/`:

- `/` scoreboard: namespace totals, expiring-soon list with risk bands, endowed-vs-not ratio, value at risk by tier.
- `/name/[label]` card: expiry, tier, endowment assets, funded-until **range**, patrons, record status; endow flow (mint test USDC → approve → endow; optional owner step: authorise record keys); "renew now" button for anyone when the trigger holds, showing the tip.
- `/graveyard`: lapsed names.
- `/bench`: unlinked contract bench page per `web3-chain-layer`.
- Chain layer: one registry from `core`, wagmi hooks one-per-entrypoint in `hooks/chain/`, tx toasts morphing at one id, receipt awaited, indexing phase until the subgraph shows the change.
- Banner: "unaudited testnet software, deposits capped at 100 test USDC, yield on testnet is simulated".

**Gate:** The 90-second demo script (→ HANDOVER §9.5) runs end to end on Sepolia from a clean browser profile against `pnpm dev`, twice.

### Phase 7 — Submission, not later than Sun 2026-09-13 10:00 EDT

- README per `CLAUDE.md` README rule and HANDOVER §15: custody posture first, problem statement verbatim, the 28-day grace cut, prior art, limitations, setup and run, the fork-test yield number, the renewal tx from a non-owner.
- Video 2–4 min, 720p+, real narration: scoreboard → endow → record appears → non-owner renews → graveyard → agent answering one question.
- ETHGlobal dashboard: title, description, repo, video, two sponsor tracks (ENS Track 1, The Graph Track 2). Third slot stays empty unless HANDOVER §9.2's test is passed.
- Rehearse three times, record, submit by 10:00 EDT: two hours of margin before the hard cut-off.

**Gate:** submission confirmation email.

---

## 3. Commands (become real as phases land; copy into `CLAUDE.md` when they do)

| Command | Does |
|---|---|
| `pnpm check` | lint + typecheck + test across the workspace, plus `forge test` |
| `pnpm build` | core → agent → web, in order |
| `pnpm dev` / `pnpm dev:claude` | web on 3000 (user) / 3100 (agent) |
| `pnpm --filter @spirith/core test` | pricing and runway pins |
| `pnpm --filter @spirith/agent test` | optimiser |
| `pnpm --filter @spirith/agent mcp` | start the MCP server on stdio |
| `pnpm --filter @spirith/agent keeper once --label <l> [--dry-run]` | one renewal attempt |
| `pnpm --filter @spirith/subgraph deploy:studio` | codegen, build, deploy to Studio |
| `forge test` (in `contracts/`) | unit + invariants |
| `forge test --fork-url $SEPOLIA_RPC_URL --match-contract RenewFork` | live registrar path |
| `forge test --fork-url $MAINNET_RPC_URL --match-contract ERC4626AdapterFork` | real yield |
| `forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify` | deploy + write `deployments/sepolia.json` |

---

## 4. Risks and the fallback for each

| Risk | Fallback |
|---|---|
| Sepolia RPC flaky on demo day | Pre-recorded video is the submission; live demo is a bonus. Keep an Alchemy and a public RPC in `.env`. |
| Test names do not reach the lead window before the video | The heuristic path lets `renew()` run early when the duration matches `optimalDuration`; endow enough for a 2-year block and demo that. |
| Subgraph Studio indexing lag | Dashboard reads on-chain for the name card (wagmi), subgraph only for lists; the agent tolerates `_meta.block` lag and says so. |
| Record write reverts for a name registered with `PublicResolverV2` | Expected and handled: best-effort write, "record: not supported by this resolver" in the UI. Demo with a name on a PermissionedResolver (manager.ens.dev default). |
| Time | Cut in HANDOVER §9.4 order. Multi-patron falls back to single patron per name by removing the inner mapping, not by rewriting. |
| Mainnet fork RPC unavailable | The fork test is CI-optional behind `MAINNET_RPC_URL`; the README states the last observed run and its number. |
