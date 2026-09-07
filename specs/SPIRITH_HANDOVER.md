# Spirith — Project Handover

**For:** Claude Code (implementation agent)
**Written:** 2026-09-05
**Event:** ETHGlobal ETHOnline 2026
**Hard deadline:** Sunday 2026-09-13, 12:00 EDT (16:00 UTC) — **~8 days from now**

> ⚠️ **Timeline correction.** Earlier planning assumed ~13 days. It is now Sept 5. You have **8 days**, one of which must be reserved for the demo video. Scope accordingly — the "Cut list" section is not optional.

---

## 1. What Spirith is

**One line:** Deposit once. Your ENS name renews itself forever.

**Phase 1 (this hackathon):** A non-custodial endowment for ENS names. A user deposits USDC into a per-name vault. The deposit earns yield. When the name comes due, *anyone* can trigger the renewal — the vault pays the ENSv2 registrar directly and tips the caller. The name publishes its own funding status as a resolver record, and a public dashboard scores the liveness of the whole namespace.

**Phase 2+ (post-hackathon):** Phase 1 is the finished product for the first of three bills. The same mechanic then pays the second, keeping a copy of the bytes an NFT points at, and last the third, the DNS domains legacy contracts still hard-code. See §10–12.

### The problem statement (use verbatim in the submission)

> We built machines that remember forever and hung them on hooks that have to be paid for every year. Ethereum will hold your token until the sun burns out; the name it answers to dies after 28 days of silence. Everything we call permanent is rented — the name, the record, the link an immutable contract can never be taught to forget — and the rent falls due on a calendar nobody is watching, charged to a card somebody stopped checking. Nothing breaks loudly. There is no revert, no failed transaction, no alert. The name simply stops resolving, and the thing behind it remains perfectly intact, perfectly addressed, and permanently unreachable. This is not a storage problem. Permanence has an invoice, and nobody ever set up the standing order.

### The insight that makes it work

**ENSv2 `renew()` is callable by any account, and accepts ERC-20 payment.**

That single fact means the endowment contract never takes custody of the name. It holds money and pays a bill that anyone is allowed to pay. No approvals over the name, no wrapping, no transfer of ownership. Compare with DNS, where permanence requires handing someone a registrar login — which is exactly why ENS is Phase 1 and DNS is last.

**Positioning line:** *We custody money. We never custody the name. The worst thing that can happen to a user is losing their deposit. It is structurally impossible for them to lose their identity.*

---

## 2. Verified facts (with sources)

These were confirmed from primary docs during planning. Do not re-derive; do re-verify anything marked ⚠️.

### ENSv2 ETH Registrar
Verified 2026-09-05 against source (`ensdomains/namechain`, `contracts/src/registrar/`) and on-chain Sepolia.

```
commit(commitment)                                              // 60 s min, 1 day max
register(label, owner, secret, subregistry, resolver, duration, paymentToken, referrer)
renew(label, duration, paymentToken, referrer)                  // callable by ANY account
getRenewPrice(label, duration, paymentToken) -> uint256          // on the registrar, discount included
isRenewable(label) -> bool                                       // REGISTERED, or expired and inside grace
getRemainingGracePeriod(label) -> uint64
GRACE_PERIOD = 28 days   MIN_REGISTER_DURATION = 28 days   MIN_RENEW_DURATION = 1 s
event NameRenewed(tokenId indexed, label, duration, newExpiry, paymentToken, referrer indexed, amount)
```

- **Payment:** `safeTransferFrom(paymentToken, msg.sender, BENEFICIARY, amount)`. The caller approves the registrar, then calls. The caller is the payer, so the vault approves and calls and the money leaves the vault straight to ENS.
- **There is no renewal window.** `renew()` succeeds any time the name is `REGISTERED` or inside the 28-day grace, for any duration of at least 1 s; the only cap is `uint64` overflow of `expiry + duration`. Timing is a purely economic decision (§6). The true deadline is `expiry + 28 days`.
- Renewal calls `ETH_REGISTRY.renew(tokenId, newExpiry)`; the registrar holds `ROLE_RENEW` on the registry root. That role is the registrar's own. Permissionless renewal needs no role at all.
- Reading a name: `ETHRegistry.findExpiry(label)`, `findOwner(label)`, `getResolver(label)`, `getState(tokenId)` returning `{status in {AVAILABLE, RESERVED, REGISTERED}, expiry, latestOwner, tokenId, resource}`. Token ids are mutable across re-registration; index by labelhash.
- v1 names pre-mirrored into the beta registry (`vitalik.eth`, `nick.eth`, ...) are `RESERVED` with a zero owner and are **not renewable through the v2 registrar** (a separate `ETHRenewerV1` handles them). Spirith v1 covers natively registered v2 names only.

### ENSv2 pricing
Verified on-chain against the live `StandardRentPriceOracle`.

- Base: 3 chars **$640/yr**, 4 chars **$160/yr**, 5+ chars **$8/yr**. 1 and 2 char labels are invalid.
- **Duration discounts apply to renewals.** `getRenewPrice` -> `getBasePrice` -> `applyDiscount`. Pay 87.5% at 2 y or more, 68.75% at 3 y or more, 56.25% at 6 y or more, i.e. 12.5% / 31.25% / 43.75% off the whole duration. There is no further step above 6 y. Live check on a sibling deployment: `vitalik.eth` 1 y = 8.000021 USDC.
- Expiry premium: $100, halving daily, zero after 21 days. Charged on `register` only, never on `renew`.
- Payment tokens on the live oracle: **MockUSDC** `0x768f42455a2d082e23ceef7d51e5787c82d67a39` (6 decimals, permissionless `mint(to, amount)`) and **Circle Sepolia USDC** `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`. Both 1:1 to the dollar. Aave's Sepolia test USDC is not accepted.

### ENSv2 Sepolia beta deployment (chain 11155111)
Source: https://docs.ens.domains/learn/deployments#sepolia-ensv2-beta. Verified live 2026-09-05: the fixed Universal Resolver entry point `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe` resolves `eth` to the ETHRegistry below, and the registrar's oracle and registry match. The `ensdomains/namechain` repo holds two *other* Sepolia sets (`deployments/sepolia` and `deployments/sepolia-official-v1-20260525-r2`); both are live contracts but neither is wired to the entry point. Do not use them.

| Contract | Address |
|---|---|
| ETHRegistrar | `0xa88553f454b77203b0d036a05c894d555eaaa2cc` |
| ETHRegistry (`.eth` PermissionedRegistry) | `0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2` |
| RootRegistry | `0x8115186e8f2e0b0281e86ab91f0f48ba90364354` |
| StandardRentPriceOracle | `0x8914b66260eb8c4fff795650c3ae8cd335958987` |
| MockUSDC | `0x768f42455a2d082e23ceef7d51e5787c82d67a39` |
| MockDAI | `0x5472c5725a00b7ba11f0794a79d08ade6f4683bd` |
| PermissionedResolverImpl | `0x9eae5c2730a7dd16bdd1dee6421a1b91e3b0365e` |
| VerifiableFactory | `0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef` |
| UniversalResolverV2 (behind the proxies) | `0x4a1817d13e9cf196f471725176355c1234b63c70` |
| PublicResolverV2 | `0xe7b9a25607e02da8145e4eb1836ca539e53f11f7` |
| Payment beneficiary | `0x84D3a426D4E12E955d1DF95db0B24fe26afE39D3` |

Apps: https://manager.ens.dev (register, manage) and https://explorer.ens.dev. Activity in the week to 2026-09-05: about 500 registrations and 3,400 renewals, almost all in MockUSDC, so the scoreboard will not be empty.

### PermissionedResolver write path
- Each account gets its own resolver: a UUPS proxy of `PermissionedResolverImpl` deployed through `VerifiableFactory.deployProxy(impl, salt, initData)` with `initialize(admin, roleBitmap, setters)`. The registry points the name at it via `setResolver`.
- `setText(node, key, value)` requires `ROLE_SET_TEXT` (`1 << 4`) on `resource(node, key)` or `resource(node, 0)`. The owner delegates one key with `authorizeTextRoles(dnsEncodedName, key, account, true)`; `authorizeNameRoles(dnsEncodedName, ROLE_SET_TEXT, account, true)` covers every key.
- Consequence: Spirith's record write needs a one-time owner action, and renewals must never depend on it (§4.3).

### The `referrer` parameter
- `bytes32`, emitted unchanged in `NameRegistered` and `NameRenewed`. **Nothing on-chain pays a referrer.**
- Off-chain, the ENS Referral Program (run by NameHash Labs, funded by the ENS DAO under SPP2, $50k committed) reads those events and pays awards to the encoded address. Encoding: 12 zero bytes then the 20-byte mainnet address. Covers registrations and renewals. **No awards on Sepolia.** Sources: https://github.com/namehash/ens-referrals and https://namehashlabs.org/ens-v2-referral-programs.

### ENSv2 vs v1
Source: https://docs.ens.domains/ensv2/overview/

| Aspect | v1 | v2 |
|---|---|---|
| Grace period | 90 days | **28 days** |
| Payment | ETH only | **ERC-20** |
| Pricing | flat per year | duration discounts |
| Ownership | ERC721 | ERC1155Singleton |
| Permissions | fuses (NameWrapper) | **EnhancedAccessControl** (role-based) |
| Registry | flat | hierarchical, subregistries |
| Resolver | shared | **PermissionedResolver**, per-account, per-record permissions |

The grace period cut from 90 → 28 days is a **pitch weapon**. Open with it: *"ENSv2 reduced the margin for human error by two thirds."* It makes the problem ENS's own, and it proves you read their changelog.

### Prior art (cite it — it makes you look rigorous, not derivative)
- **[self-repaying-ens](https://github.com/The-Wary-One/self-repaying-ens)** — Gitcoin Money Legos 2022 winner. Auto-renews ENS names using **Alchemix self-repaying debt** + **Gelato** automation + **Curve** for alETH→ETH. Same instinct, financed by *debt* rather than *endowment*. Single collateral type, mainnet only, no monitoring layer, dormant.
- **v3xlabs/rescue-name** — tooling in the expiring-names space.
- ENS's own UI supports paying many years upfront. That is prepayment, not perpetuity, and it is capped by how much you want to spend today.

**Spirith's delta:** endowment not debt; non-custodial; multi-patron; ENSv2-native; duration-discount optimisation; plus a public liveness layer over the whole namespace.

---

## 3. Open questions

None. The six Day-1 questions (USDC accepted, discounts on renewals, renewal price accessor, referrer economics, deployment addresses, renewal window) were resolved on 2026-09-05 and live as facts in §2. A new question goes here with the work it blocks.

---

## 4. Architecture

Everything is on **one chain**. Money and name live together. This is a hard constraint — see §13 for what was rejected and why.

```
┌───────────────────────────────────────────────────────┐
│                    Ethereum (Sepolia)                 │
│                                                       │
│  SpirithVault.sol ──── approve + renew() ───▶ ENSv2   │
│      │                                     ETHRegistrar│
│      │ deposit/withdraw                               │
│      ▼                                                │
│  IYieldAdapter ──▶ MockYieldAdapter (demo)            │
│                └─▶ ERC4626Adapter (fork-tested)       │
│      │                                                │
│      └──── writes ────▶ PermissionedResolver          │
│                        (spirith.funded-until record)  │
└───────────────────────────────────────────────────────┘
              │ events
              ▼
        Subgraph (The Graph)
              │
              ▼
     Liveness Agent (Subgraph MCP)  ──▶  Next.js dashboard
```

### 4.1 `SpirithVault.sol`

**Design rules — these are load-bearing, do not "improve" them away:**

- **Per-name earmarks. No shared pool.** `alice.eth`'s deposit can never pay for `bob.eth`. No rehypothecation. This removes an entire class of exploit and makes the contract explicable in one sentence.
- **Exactly two exits, hard-coded.** Money leaves either (a) to the ENS registrar as a renewal payment, or (b) back to a patron. No third destination exists in the code. The renewal path calls the registrar directly — never an intermediary address.
- **No admin key can move funds.** Pause may block *new deposits only*. It may never block a withdrawal or a renewal. State this in the README's first paragraph; it is the first question a competent judge asks.
- **Withdrawals are always available**, subject to a notice period (30 days) so that "funded until 2149" stays a truthful claim. Delayed, never blocked.
- **Multi-patron per name.** Anyone can top up any name. Each patron can withdraw only their own share. This enables "adopt a name" and is what makes it a public good rather than a subscription.
- **Deposit cap for the hackathon** (e.g. $100 equivalent) + "unaudited testnet software" banner. Correct posture, and it preempts the audit question.

**Exits, precisely.** Tokens leave a name's earmark to the registrar's beneficiary as a renewal payment, to the keeper as the capped tip in that same transaction, or to the patron of record after notice. The invariant suite (`test/invariants/TwoExits.t.sol`) reconciles every token minted into the system against exactly those three ledgers.

**Custody model (decided 2026-09-05).** ENSv2 has no escrow, prepaid balance, share or "pay from this address" concept: `renew()` pulls the payment token from `msg.sender` via `safeTransferFrom`, and Enhanced Access Control roles govern the name, never money. So the vault holds the yield shares itself: it calls the ERC-4626 vault with `receiver = SpirithVault`, and a patron holds only an internal, per-name claim on those shares (`patronShares`). Converting shares to USDC on renewal day is an ERC-4626 `redeem`, not a swap. This is custody of money, stated openly. What stops it being a honeypot is the two-exits invariant above, not a custody trick: the only token destinations in the code are the registrar and the patron of record, with no admin path to a third, and the Foundry invariant suite must prove exactly that. A patron exits via `requestWithdraw` → `executeWithdraw` at the current share price; the 30-day notice is what keeps the resolver record truthful. Rejected alternatives: §13.

**Shape (as built in `contracts/src/SpirithVault.sol`):**

```solidity
struct Endowment { uint256 reserve; uint256 adapterShares; uint256 totalShares; } // per labelhash
struct Position  { uint256 shares; uint256 noticeShares; uint64 noticeAt; }       // per patron

function endow(string label, uint256 assets) returns (uint256 shares);   // anyone, any renewable name
function requestWithdraw(string label, uint256 shares);                  // starts the 30-day notice
function executeWithdraw(string label) returns (uint256 assets);         // after notice; never paused
function pause(); function unpause(); function renounceOwnership();      // OZ Ownable2Step + Pausable;
                                                                         // renouncing lifts any pause

/// @notice Permissionless. Anyone may call. Caller receives a capped tip.      (Phase 2)
function renew(string label, uint64 duration);
function runwayOf(string label) view returns (uint64 low, uint64 high, uint256 assets, uint64 optimalDuration);
```

Share math uses one virtual share and one virtual asset per name (`assets × (S+1)/(A+1)`), which
neutralises first-depositor inflation at the cost of at most one unit of dust; the last patron
out takes the whole holding, dust included, so a name never carries orphaned shares. The
adapter position is per-caller and the vault approves it for the exact amount of each deposit,
so no standing allowance exists. `endow` uses `registrar.isRenewable(label)`, which admits
`REGISTERED` names and names in grace and rejects pre-migrated v1 reservations.

**`renew()` flow:**
1. `price = registrar.getRenewPrice(label, duration, USDC)`; the discount is already applied.
2. Require the trigger: `expiry - now <= RENEW_LEAD` (30 days, expiry from `ETHRegistry.findExpiry`); names in grace pass trivially. ENSv2 has no window of its own; this guard stops keepers burning yield by renewing years early. **And** require `duration == optimalDuration(label)` (decided 2026-09-07): the keeper names the duration so a price change between simulation and execution reverts instead of overspending, and no keeper can pick a worse cadence than the earmark affords. There is no "renew early if the heuristic approves" path; it would let a keeper farm tips by prepaying the whole earmark.
3. Pull `price + tip` into liquid USDC: from the reserve first, then `adapter.redeem` for any shortfall.
4. `USDC.approve(registrar, price)`; `registrar.renew(label, duration, USDC, SPIRITH_REFERRER)` with `SPIRITH_REFERRER = bytes32(uint256(uint160(address(this))))`.
5. Transfer `tip` to `msg.sender`. **Tip must be capped** — `min(bps * price, TIP_CAP)` — and paid from that name's own earmark, so keeper incentives cannot be farmed into draining a vault.
6. Best-effort record write (§4.3): `try resolver.setText{gas: RECORD_GAS}(node, key, value)` on the resolver returned by `ETHRegistry.getResolver(label)`. A revert (owner never authorised Spirith, or a different resolver type) is swallowed and reported in the `Renewed` event. Emit `Renewed`.

**Reserve buffer:** keep N years of renewals as liquid USDC in the vault; only the excess is deployed to the yield adapter. **A name's survival must never depend on an external system being available on the day it is due.** This principle recurs in every phase of this project.

### 4.2 `IYieldAdapter`

```solidity
interface IYieldAdapter {                       // per-caller accounting; the vault is one caller
    function asset() external view returns (IERC20);
    function deposit(uint256 assets) external returns (uint256 shares);   // pulls from msg.sender
    function withdraw(uint256 assets) external returns (uint256 shares);  // exact assets out
    function redeem(uint256 shares) external returns (uint256 assets);
    function sharesOf(address) external view returns (uint256);
    function convertToAssets(uint256) external view returns (uint256);
    function convertToShares(uint256) external view returns (uint256);
    function rateRangeBps() external view returns (uint16 low, uint16 high); // range, per §4.4
}
```

Ship **three** implementations:

1. **`MockYieldAdapter`** — deterministic simple interest at a fixed rate, realised by minting the asset to itself (ENS's MockUSDC has a permissionless `mint`). **This is what the live demo runs on.** It cannot break on stage and must never face a real token.
2. **`ERC4626Adapter`** — generic wrapper. Works with Aave v3 supply, sDAI, Savings GHO, Morpho vaults, Aave Stable Vaults. **Write to ERC-4626, never to a specific protocol.**
3. Optionally a thin `AaveStableVaultAdapter` if time allows.

**Prove the real one with a Foundry mainnet-fork test.** A fork test showing a real deposit, real accrual, and a real renewal paid from yield is far more convincing than a testnet mock, and costs an afternoon. Put it in the README.

**Fork target (decided 2026-09-05):** Aave v3 Ethereum USDC stata token, ERC-4626, `0xD4fa2D31b7968E448877f69A96DE69f5de8cD23E` (`USDC_STATA_TOKEN` in the bgd-labs address book), underlying USDC `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`. The renewal leg of that test targets a local mock registrar, since ENSv2 is not on mainnet.

**On Sepolia the adapter is always the mock.** No lending market accepts the ENS payment tokens there, so testnet yield is theatre by construction; the honest UI says so.

**Yield venue guidance (decided):** for v1, **same-chain beats fixed-rate**. Use a plain ERC-4626 stablecoin vault on Ethereum. Aave Stable Vaults were evaluated and deferred — their accounting chain is **Arbitrum** with earning on Ethereum mainnet (verified 2026-09-05 against the Aave architecture doc: "For the Aave App, the Accounting Chain is Arbitrum" and "Earning Chains (Ethereum mainnet initially) host yield strategies"; the Stable Vault contract, the user entrypoint, sits on the Accounting Chain), which reintroduces exactly the cross-chain dependency this project deliberately avoids. Their two-step withdrawal (request → execute) and the fact that **the interest portion gates against system surplus while only principal is unconditionally redeemable** also complicate a perpetuity claim. Revisit when their accounting reaches Ethereum, or when Namechain forces multi-chain anyway. The fixed rate is a genuinely good reason to come back — it is what would let the UI quote a *date* instead of a *range*.

### 4.3 Resolver record

Write the funding status onto the name itself via the owner's ENSv2 **PermissionedResolver**:

```
spirith.funded-until = <unix timestamp, conservative end of the range>
spirith.patrons      = <count>
```

Composable: any wallet, marketplace or resolver sees the name is endowed without asking Spirith. Together with permissionless `renew()` this is the ENS-track centrepiece.

Mechanics (facts in §2): the name owner calls `authorizeTextRoles(dnsName, key, SpirithVault, true)` once per key, offered in the endow flow as an owner-only, optional step ("let Spirith publish this name's funding status"). A name on the shared `PublicResolverV2` first needs its own PermissionedResolver: `VerifiableFactory.deployProxy` with `initialize(owner, allRoles, [])`, then `ETHRegistry.setResolver`; `contracts/script/PrepareName.s.sol` does all three from the owner key, and the dashboard offers the same. The vault writes on every `endow`, `renew` and `executeWithdraw`, best-effort with a 150k gas stipend per call, and reports `recordWritten` in `Renewed`. A name whose owner never authorises Spirith is still renewed; the dashboard shows "record: not authorised". `spirith.funded-until` carries the low end of the runway range as a unix timestamp.

There is no renewer role to define: `renew()` is open to everyone by design and the registry's `ROLE_RENEW` belongs to the registrar. Subregistries (one endowment covering a subname tree) stay in the cut list as the optional extension.

### 4.4 Honest UI rule

With a variable rate, the card must quote a **range**, not a date: *"funded through 2140–2165 at current rates."* Only a contractually fixed rate earns a single year. Being precise about your own uncertainty is what separates this from every other project promising forever.

---

## 5. Subgraph (The Graph)

Index ENSv2 on Sepolia **plus** Spirith's own events.

**Entities:**
- `Name` — label, expiry, price tier, character length, owner
- `Endowment` — balance, shares, funded-until projection, patron count
- `Patron` — address, names supported, total contributed
- `RenewalEvent` — who called, duration purchased, price paid, tip paid
- `LivenessScore` — days-to-expiry, endowed?, risk band

**Derived views the dashboard needs:**
- Names expiring in the next 7 / 28 / 90 days
- Total value at risk (by price tier — 3-char names are 80× the endowment burden of 5-char names)
- Endowed vs unendowed ratio across the namespace
- "Graveyard" — names that already lapsed

---

## 6. The agent (this is what earns The Graph's AI track)

Not "watch for expiry" — that is a cron job. The agent's real job is **optimising renewal cadence against the duration-discount curve.**

The naive strategy — renew one year at a time — is the *worst* option. Renewing in 6-year blocks is ~44% cheaper per year. But capital spent on a 6-year renewal stops earning yield. So for each name there is a genuine optimisation over `(balance, yield rate, price tier, discount curve, current expiry)`.

**Delivery (decided 2026-09-05):** a Spirith MCP server (`packages/agent`) exposing the tools below, backed by the Spirith subgraph's Subgraph Studio endpoint and API key. The Graph's hosted Subgraph MCP routes only through the gateway to network-published subgraphs, and Sepolia is Studio-only, so it cannot see our data. The Graph's track text accepts Studio API-key consumption. The optimiser is pure, unit-tested TypeScript in the same package.

**Agent tools:**
- `namesAtRisk(days: int)` — ranked by value and time-to-death
- `runway(name)` — projected funded-until, with the rate assumption stated
- `optimalCadence(name)` — recommended renewal duration and why
- `portfolioHealth(address)` — "which of my names dies first?"
- `rescueProposal(name)` — how much is needed, what it buys

Keep an on-chain heuristic in the contract (longest affordable duration above a reserve threshold) and let the agent do the sophisticated version off-chain. The contract must never depend on the agent.

---

## 7. The `referrer` parameter — business model, contingent

`renew(label, duration, paymentToken, referrer)` takes a referrer on every call. Spirith passes its own address, left-padded to `bytes32`, on **every renewal it ever executes**.

What that buys (facts in §2): nothing on-chain and nothing on Sepolia. On mainnet, the DAO-funded ENS Referral Program pays awards to the referrer address for the registrations and renewals it attributes. Setting the field costs nothing and gives Spirith a claim on a program that already exists, which can fund keeper tips and the dashboard **without a token, a fee switch, or a rent-seeking layer**. Say exactly that in the submission: a self-funding public good, contingent on a DAO program Spirith does not control.

---

## 8. Economics

Using confirmed ENSv2 pricing:

| Name length | List price/yr | Effective/yr @ 6y (43.75% off) | Perpetual, 6y blocks @ 5% | Perpetual, 6y blocks @ 4% |
|---|---|---|---|---|
| 5+ chars | $8 | $4.50 | **~$107** | **~$129** |
| 4 chars | $160 | $90 | ~$2,130 | ~$2,580 |
| 3 chars | $640 | $360 | ~$8,500 | ~$10,300 |

The "perpetual" columns account for the yield forgone on capital spent six years ahead: the
endowment must return to its starting balance by the next renewal, `(A - cost6y) × (1 + r)^6 ≥ A`.
The naive `$4.50 / 4% = $112.50` ignores that and is not enough. Renewing yearly needs ~$208 at
4%, which is why cadence (§6) is worth optimising. Thresholds are pinned in
`packages/core/test/runway.test.ts`; the on-chain prices they use are pinned in `pricing.test.ts`.

**Headline: ~$110–130, once, makes a normal `.eth` name immortal at 4–5% yield.**

That number is small enough that it stops sounding like a financial product and starts sounding like a rounding error — which is the emotional point of the entire pitch.

**Best dashboard visual:** the contrast. The short, expensive, heavily-speculated names are the ones most likely to die.

**Caveats to state openly (do not bury):** stablecoin yields are not guaranteed; a perpetual endowment priced off today's rate is a forecast, not a law. Recommend endowing with 2–3× margin. Anyone claiming a risk-free perpetuity is doing the thing this project exists to criticise.

---

## 9. Hackathon execution

### 9.1 Submission requirements
- Repository link, public, open source
- **Demo video 2–4 minutes, 720p minimum.** No text-to-speech narration. No phone recording. Clear audio.
- Project title + description via Hacker Dashboard
- **Maximum 3 partner prizes.** *Up to* three — two is allowed and often better.
- Deadline **Sun 2026-09-13 12:00 EDT**. No late entries.

### 9.2 Sponsor selection

**LOCKED:**

| Sponsor | Track | Prize | Why it's earned |
|---|---|---|---|
| **ENS** | Track 1 — Best Use of ENSv2 (Sepolia) | $4.5k (1st $1.5k) | ERC-20 renewal path, PermissionedResolver liveness record delegated via `authorizeTextRoles`, Enhanced Access Control as the delegation primitive, subregistries optional. Central, not decorative. |
| **The Graph** | Track 2 — Best AI Tooling (From Scratch) | $5k (1st $2.5k) | A Spirith MCP server over the Spirith subgraph (Studio) is load-bearing; the cadence optimiser is real work on live data; net-new. |

**THIRD SLOT — leave empty until the unpublished tracks land.** Two deeply integrated sponsors beat three with one bolted on. Candidates in order:

1. **Privy** ($5k, track unpublished) — if it's about onboarding: *"endow someone's name as a gift, by email, no wallet required."* Best remaining story, on Ethereum, no detour.
2. **Uniswap Foundation** ($5k) — **only** for the *Endowment Hook*: an opt-in v4 hook routing a basis point of a pool's fees into keeping that project's ENS name alive forever. A DAO's own trading activity funds its own identity. Genuinely novel, but the largest remaining scope. Requires `FEEDBACK.md` + their developer feedback form.
3. **Chainlink** ($3k, unpublished) — Automation as a belt-and-braces renewal trigger. Safe, small, and **slightly redundant** because the tip already funds the keeper. You would have to admit that onstage.

**Do not add a sponsor unless it passes this test: would you use it if there were no prize?**

### 9.3 Plan

Phases, gates, project structure and commands live in `SPIRITH_PLAN.md`. Submit by Sun 2026-09-13 10:00 EDT, two hours before the hard cut-off.

### 9.4 Cut list (in this order, without guilt)
1. Uniswap Endowment Hook
2. `AaveStableVaultAdapter` (keep generic ERC-4626)
3. Multi-patron (fall back to single depositor per name)
4. Subregistry / tree endowments
5. On-chain cadence optimiser (move fully to the agent)

**Never cut:** the permissionless `renew()`, the per-name earmark, the resolver record, the dashboard, the video.

### 9.5 Demo script (90 seconds)
1. Dashboard: namespace scoreboard. N names die this month. One card is red — 3 days left.
2. Deposit USDC into that name's vault. Card flips: *funded through 2140–2165*.
3. Resolver record updates live — the name now advertises its own funding.
4. **Trigger `renew()` from a wallet that does not own the name.** Show the tx. Expiry extends. This is the moment — it proves permanence can be a public good rather than a subscription.
5. Cut to the graveyard view: names that already lapsed, permanently.

---

## 10. Phase 2 — File permanence

**Why it's Phase 2:** paying for storage is permissionless and contract-payable, exactly like an ENS renewal, and unlike a DNS lease. Phase 1 is the finished product for the first bill, names dying after 28 days of silence; it is not a prototype for Phase 2. Phase 2 applies the same runway mechanic to the second bill, the bytes an NFT points at. Each phase is a separate product built on the same rules: per-item earmarks, permissionless payment, two exits, a public runway.

### 10.1 Point `tokenURI` straight at the bytes (decided 2026-09-07)
A permanent collection returns `ipfs://<cid>/<path>` from `tokenURI`. The CID is a fingerprint of the content, so the pointer can never expire, be rented, or be swapped for a fake. Marketplaces fetch `ipfs://` themselves; nothing else is needed on the pointer side. The only remaining job is keeping a copy of the bytes pinned, which is what the Phase 2 endowment pays for.

Facts (verified 2026-09-07):
- OpenSea's metadata standards document `https` and `ipfs://` URIs. `ar://` works in practice but is not documented there.
- `web3://` (ERC-4804 Final, ERC-6860 Draft) resolves a name to a contract call, not to content, and no marketplace accepts it as a `tokenURI`. There is no `ens://` scheme.
- Gateway URLs (`name.eth.limo/…`, `gateway.pinata.cloud/ipfs/…`) work in every client but hard-code a DNS domain someone else rents: `eth.link` expired in 2022 when its only renewer was in prison; `eth.limo` was hijacked at its registrar in 2024. Never put a gateway in a `tokenURI`.
- An ENS name between the contract and the CID (contract reads the name's `contenthash`, a view call on the v1 PublicResolver and the ENSv2 PermissionedResolver) adds exactly one thing, a mutable pointer, at the price of a renewal bill and an owner who can change the art. For a frozen collection that is a liability. Rejected as the default; §13. It remains the mechanism for the one variant that needs mutability (§10.5, Hostage NFTs).

### 10.2 Infrastructure already exists (this is not the hard part)
- **Filecoin Onchain Cloud** (shipped late 2025) — **Filecoin Pay** gives streaming smart-contract payments to storage providers that settle per epoch, and **payment pauses automatically when storage proofs stop arriving**. Warm Storage ≈ **$2.50/TiB/month**. **Synapse SDK** is a normal JS upload/retrieve/pay API. **Filecoin Pin** bridges IPFS CIDs. *Use this. Do not run a node.*
- **Arweave** — endowment model, pay once, funded on a declining-storage-cost assumption. Closest philosophical relative.
- **Swarm** — postage stamp batches drain at the network price and data expires unless topped up. **Your runway mechanic already exists here** — just private, per-batch, and invisible.

**The gap Spirith fills:** nobody has made the runway a *social object* — public, priced, collectively rescuable. It is a design problem, not an infrastructure problem.

### 10.3 The endowment covers one line
**Bytes** — Filecoin/IPFS, ~$2.50/TiB/month, paid by streaming contract payments that pause when storage proofs stop. With `tokenURI` pointing straight at a CID there is no route line and no domain. Legacy collections keep both (§11.3). For EUCLID (§11.6) the domain costs ~200× more per year than the storage: everything the industry talks about, decentralised storage and content addressing, is the cheap, solved part. What kills collections is a $12 annual invoice on one person's card.

### 10.4 The liveness oracle
An agent that walks a contract's `tokenURI`, follows every hop, fetches the bytes, hashes them, and compares against a committed hash. Gives a public, verifiable answer to **"is this NFT still actually there?"** — and it works read-only on *anyone's* collection. Showing a wall of blue-chip NFTs with red liveness scores is the strongest visual this project has.

### 10.5 Mechanism variants (all discussed; pick per audience)
- **The Decaying Gallery** — files don't die, they degrade. Resolution drops as runway shortens; a top-up snaps it back instantly. Best demo of the set, and cheap to build (it's a render policy, not a storage trick).
- **Hostage NFTs** — per-file endowments; the NFT points at an ENS name whose contenthash the endowment controls, the one case that needs a mutable pointer (§10.1). Empty endowment → tombstone → the collector's JPEG goes blank publicly. Exposes the real, uncomfortable truth: most NFTs are one unpaid invoice from nothing.
- **Attention Pays Rent** — every view costs half a cent (x402-metered) and every cent funds that file's endowment. Popular work funds its own immortality; forgotten work dies unless adopted. No token, no DAO, no death spiral.
- **Runway as a market** — share token redeemable against the treasury; a Uniswap v4 hook widens the mint discount as runway shortens, turning a doom loop into a coordination game. ⚠️ Weakest: the reflexivity (runway ↓ → price ↓ → harder to refill) is a death spiral a judge will find in ten seconds.
- **Mint-funded perpetual care** ⭐ — route $0.50 or 0.1% of every mint into that token's care fund at the moment of sale. The collector never makes a decision; the artist never sets a reminder; the collection reaches mint-out already funded. **This is the actual business.** It converts the pitch from charity ("rescue dying art") into infrastructure ("every mint funds its own permanence, automatically, for 16¢").

---

## 11. Phase 3 — DNS domains (legacy)

**Why it's last:** only contracts whose immutable `tokenURI` already names a DNS domain need it; a new collection uses §10. ENS renewal is permissionless and ERC-20-payable. DNS renewal is neither. A `.com` is a lease from a registry administered by an ICANN-accredited registrar held by a legal person. **A smart contract cannot be a registrant.** There is no trustless version.

### 11.1 The three roles (keep them separate — conflating them is the classic mistake)
1. **Registrant** — the legal person on the lease. Cannot be a contract.
2. **DNS operator** — whoever serves the zone. A *different* account, and free (Cloudflare, or the registrar's nameservers). Holds two records.
3. **Payer** — the endowment. This is the only one that can be a contract.

### 11.2 Payment options, ranked
1. **Prepay 10 years** at registration. Most gTLDs allow it. One human action, then a decade of nothing. **For production this is genuinely the correct answer** and saying so onstage reads as rigour, not evasion.
2. **Mainstream registrar API + stablecoin card.** Namecheap / Dynadot / Porkbun have APIs with prepaid account balances. Fund the balance from a USDC-backed card (Gnosis Pay, Kast, etc.). An agent watches expiry and fires renewals. Chain: USDC → card → registrar balance → renewal. Ugly, real, unattended.
3. **Crypto-accepting registrars.** Njalla (BTC/LTC/XMR/DASH), 1984 Hosting, OrangeWebsite, Virtualine. Almost all BTC/Monero, essentially none take USDC, none has a renewal API. ⚠️ **Njalla registers as owner-of-record on your behalf** — a trust hole that is unacceptable in a permanence product.
4. **Build the missing primitive: an x402-gated `renew()` service.** A small service exposing `renew(domain, years)` behind HTTP 402, accepting USDC, calling a registrar API, writing the receipt on-chain. **No smart contract on earth can currently renew a domain.** This is a genuine gap, not a hack — and a strong standalone hackathon project.

**Payment stays outside `SpirithVault`.** The two-exits rule (§4.1) forbids paying a registrar API or an x402 service from an ENS earmark. DNS endowments are a sibling contract with an explicit third exit, stated openly.

### 11.3 Hosting: you mostly don't
**DNSLink** removes the server entirely:

```
_dnslink.example.com   TXT    dnslink=/ipfs/bafy…
example.com            CNAME  <DNSLink-aware gateway>
```

Recurring cost collapses to **registration renewal + two DNS records**. DNS hosting is free.

- ⚠️ **Content-type gotcha:** extensionless files get sniffed and served as `text/plain`. Use a root `_redirects` file to rewrite `/path/metadata` → `/path/metadata.json` with a 200 rewrite, so the extension exists on disk while the URL stays identical.
- Gateways churn. Treat the gateway as swappable (one CNAME). The endowment can run its own DNSLink gateway on **Akash** or **4EVERLAND**, both of which accept on-chain payment for compute.
- Query strings: IPFS gateways ignore unknown query params (`v`, `hash`, `formula`, `resolution` are not reserved) — so a static file at the exact path answers correctly. ⚠️ Verify against the chosen gateway.

### 11.4 Anchoring ownership
ENS supports importing a **DNSSEC-signed** `.com` into ENS, including a **gasless offchain path**. This doesn't renew the registration — nothing on-chain can — but it makes ownership and the canonical CID provable from a contract, and gives a pointer that survives a hostile registrar.

Publish the expected DNS records + zone hash on-chain so any tampering is detected within the hour. You cannot prevent a custodian going rogue; you can make it loud.

How the import works (verified 2026-09-07):
- **v1 on-chain:** DNSSEC (RSA/SHA-256 or ECDSA), a `_ens` TXT record `a=0x<address>`, and `proveAndClaim` on the DNSRegistrar for up to a few million gas. Six TLDs (`.art`, `.box`, `.club`, `.hiphop`, `.kred`, `.luxe`) run their own registrars.
- **v1 gasless (ENSIP-17):** a root TXT record `ENS1 <resolver> [context]` read through CCIP-Read and verified against a DNSSEC oracle. Nothing on-chain, no NFT; a lapsed or transferred domain silently loses its ENS identity.
- **ENSv2:** `DNSTLDResolver` checks the v1 registry, then the `ENS1` record, and delegates to `DNSTXTResolver` (records inline in the TXT) or `DNSAliasResolver` (rewrites `example.com` to `example.eth`). An alias inherits every record of the `.eth`, including `spirith.funded-until` and `spirith.patrons`, but never ownership. On-chain claiming stays on v1 at launch. The contracts are not final and are absent from the Sepolia beta, so no `.com` demo is possible there.
- Whoever controls the DNS zone can re-prove and take the ENS name, in every variant. The anchor holds only as long as the zone does.

### 11.5 The escape hatch — the real Phase 3 product
Because an immutable `tokenURI` hard-codes a domain, **if the domain is lost, that URL is dead forever.** So build redundancy:
- `<project>.eth` contenthash → root CID
- bare `ipfs://<rootCID>/<path>`
- **An on-chain fallback registry:** `(chain, contract) → canonical frozen-metadata CID`, versioned and attested.

Today when a `tokenURI` 404s, every marketplace and wallet shows a broken image and gives up — there is *nowhere to look*. A public fallback registry is a small contract, an obvious idea, and nobody has built it. **This is the protocol contribution of Phase 3.**

### 11.6 Case study: collect-code / EUCLID (Roger's own collection)
Real migration target. 1,870 tokens, ERC-721 on Ethereum, **no `setBaseURI` — genuinely immutable.**

```
tokenURI: https://collect-code.com/api/token/euclid/24/metadata
          ?v=1&hash=0x5e02…&formula=pa1.bg0.ma0.tr03000.fx50.rn29…
```

Metadata (confirmed):
```json
{
  "name": "EUCLID #24",
  "external_url": "https://collect-code.com/euclid/24",
  "image": "https://collect-code.com/api/token/euclid/24/svg?resolution=1200&formula=…&hash=…",
  "background_color": "131313",
  "attributes": [ … ]
}
```

**Why this case is unusually favourable:**
- **The seed is already immutable.** `formula=` fully determines the artwork and is baked into an unchangeable `tokenURI`. The art is not at risk — only the renderer and the route.
- **`image` is SVG.** Vector, so `resolution=1200` is cosmetically irrelevant; one frozen file serves every size forever.
- **No `animation_url`, no CDN JS dependency.** The failure mode that kills most generative collections is absent.
- **`external_url` is decorative** — nothing breaks if `/euclid/24` 404s.
- ⚠️ **One check:** open a raw SVG and look for an external font reference or `<image href>`. Inline or convert to paths if found. Only expected hidden dependency.

**Migration:**

```
/index.html                            ← static homepage, reads chain client-side
/euclid/24/index.html                  ← external_url page
/api/token/euclid/24/metadata(.json)   ← frozen, byte-identical
/api/token/euclid/24/svg(.svg)         ← frozen vector
/_redirects                            ← extensionless rewrites, fixes content-type
```

Then one TXT record and the existing immutable `tokenURI` resolves from IPFS with **no server running anywhere**. Vercel becomes redundant rather than critical.

**Generate the tree from the contract, not from Vercel** — read all 1,870 `tokenURI`s on-chain (one Graph query), parse the query params, freeze. This gives the property worth putting on a slide: **anyone can rebuild the entire mirror from Ethereum alone, forever, without the artist and without Vercel.**

**Open collections are not a blocker.** A collection that is still minting is an *append-only list of already-frozen items* — each token becomes static the moment it mints. DNSLink is a mutable pointer to immutable content by design; IPFS directories are Merkle trees, so adding a token is one small file and one DNS update. Run in **shadow mode** during minting (DNS still points at the live origin, Spirith maintains and publishes the frozen tree in parallel), then cut over at mint-out. Avoid live cutover while selling: there is a DNS-propagation window where a fresh buyer's metadata 404s.

**Storage cost for EUCLID:** ~300MB → **~$0.06/year**, versus ~$12/year for the domain.

### 11.7 Name the caretaker
Roughly one human action every few years — renew, or swap a dead gateway. The system's job is ensuring that person exists, is funded, and is alerted. Long term this is a foundation, the way archives have always worked. **Pretending it is fully autonomous is the lie that kills these projects.**

---

## 12. Continuity strategy

The submission-facing proposal for everything after the hackathon, including future protocol developments, is `SPIRITH_ROADMAP.md`; it points back here for detail.

**ENS, The Graph, Arc and Hedera all run continuity tracks** paying thousands specifically for extending an existing open-source project at a later event. Build Phase 1 clean, open and well-documented, and Phase 2 is not a roadmap slide — it is a **pre-qualified entry for the next hackathon.** Say so in the submission. Judges reward teams who will obviously still exist in six months.

---

## 13. Rejected — and why (do not re-propose)

| Rejected | Reason |
|---|---|
| **Arc (Circle L1)** | Forces a cross-chain bridge into a design with no reason to leave Ethereum. Reads as a prize grab, and the bridge is the most likely thing to break on demo day. Arc mainnet also wasn't live, ruling out their Track 3. |
| **1inch Aqua for the swap** | ENSv2's ERC-20 payment eliminated the swap entirely. Even before that, a vault swapping $8 once a year is a thin "Aqua app" — the Arc mistake at smaller scale. |
| **Hedera / World** | No honest role in Phase 1. Both are strong for Phases 2/3 (proof-of-human patronage, HCS attestations, x402 renewal service) — revisit then. |
| **Aave Stable Vaults for v1** | Accounting chain is Arbitrum (per Aave architecture doc, verified 2026-09-05; Ethereum is only an Earning Chain); same cross-chain objection as Arc. Two-step withdrawal; interest gated against system surplus. Deferred, not dismissed — the fixed rate is the one thing that would let the UI quote a date instead of a range. |
| **Pull-model custody (patron keeps the yield shares, grants the vault an allowance)** | Breaks three load-bearing rules: no reserve buffer is possible, so a name dies if the yield venue is paused on renewal day; exit is instant, so "funded until 2149" describes a revocable allowance and the resolver record and liveness score become untrustworthy; and the blast radius is not smaller — a vault bug drains every approved wallet, the classic approval exploit. |
| **One escrow clone per name (ERC-1167) instead of a singleton vault** | Storage isolation is real but a bug in the shared implementation still hits every clone; resolver write permissions multiply; costs days the hackathon lacks. Post-hackathon hardening path, not v1. |
| **A Spirith token / DAO treasury** | "Token price tracks remaining runway" is a reflexive death spiral, and a single global treasury makes the blast radius the whole archive. Per-name earmarks instead. |
| **Any cross-chain hop on the renewal critical path** | A name's survival must never depend on a bridge being up on a particular Tuesday. |
| **An ENS name as the `tokenURI` anchor** (contract reads the name's contenthash, returns `ipfs://`) | A CID in `tokenURI` is already permanent, free and unforgeable. The ENS hop adds only mutability, and with it a renewal bill, an owner who can change the art, a same-chain constraint and a dependency on on-chain resolvers. KISS: point straight at the bytes. Kept only for the Hostage NFTs variant (§10.5). |
| **Pixel archiving for generative art** | Archive the machine that makes the pixels, not the pixels. Cheaper, resolution-independent, preserves the generative nature. |

---

## 14. Reference links

**ENS**
- ENSv2 ETH Registrar — https://docs.ens.domains/ensv2/eth-registrar
- ENSv2 overview — https://docs.ens.domains/ensv2/overview/
- ENSv2 contracts — https://ensdomains-contracts-v2.mintlify.app/concepts/architecture
- ENSv2 architecture blog — https://ens.domains/blog/post/ensv2-architecture
- DNS on ENS — https://docs.ens.domains/learn/dns/
- Gasless DNSSEC import — https://support.ens.domains/en/articles/8834820-how-do-i-import-my-dns-domain-into-ens-without-paying-gas
- v1 pricing — https://support.ens.domains/en/articles/12238910
- ens-cli (agent-native) — https://github.com/ensdomains/ens-cli
- Sepolia beta deployments — https://docs.ens.domains/learn/deployments#sepolia-ensv2-beta
- ENSv2 contracts source — https://github.com/ensdomains/namechain (`contracts/`); mirror https://github.com/ensdomains/contracts-v2
- Contract developer tutorial — https://docs.ens.domains/ensv2/tutorial-contract-developers
- PermissionedResolver — https://docs.ens.domains/ensv2/permissioned-resolver
- Enhanced Access Control — https://docs.ens.domains/ensv2/enhanced-access-control
- Beta apps — https://manager.ens.dev , https://explorer.ens.dev
- ENS Referral Program — https://github.com/namehash/ens-referrals

**Prior art**
- self-repaying-ens — https://github.com/The-Wary-One/self-repaying-ens
- rescue-name — https://github.com/v3xlabs/rescue-name

**The Graph**
- Subgraph MCP — https://thegraph.com/docs/en/subgraphs/tooling/subgraph-mcp/introduction/
- Supported networks (Sepolia is Studio-only) — https://thegraph.com/docs/en/supported-networks/
- Prize tracks — https://ethglobal.com/events/ethonline2026/prizes/the-graph

**Yield**
- Aave Stable Vaults — https://aave.com/docs/vaults/stable-vaults (+ `/architecture`, `/yield-strategies`)
- Aave Simple Earn (ERC-4626) — https://aave.com/docs/vaults/simple-earn/overview
- Aave address book (`USDC_STATA_TOKEN`) — https://github.com/bgd-labs/aave-address-book

**Storage / Phase 2**
- Filecoin Onchain Cloud — https://filecoin.io/blog/posts/introducing-filecoin-onchain-cloud
- DNSLink — https://docs.ipfs.tech/concepts/dnslink/
- Custom domains on IPFS — https://docs.ipfs.tech/how-to/websites-on-ipfs/custom-domains/
- Swarm postage stamps — https://docs.ethswarm.org/docs/concepts/incentives/postage-stamps/
- Arweave endowment — https://www.arweave.com/blog/endowment-with-arweave

**Event**
- Prizes — https://ethglobal.com/events/ethonline2026/prizes
- Rules & judging — https://ethglobal.com/events/ethonline2026/info/details

---

## 15. Tone guidance for the submission

The strength of this project is that it is **honest about a boring problem**. Do not oversell.

- Lead with the 28-day grace period change. Make the problem ENS's own.
- Say plainly: *we custody money, we never custody the name.*
- Put the limitations on a slide, not in a footnote: yield is a forecast; there is a caretaker role in Phase 3; testnet yield is theatre.
- Cite the 2022 prior art before a judge finds it.
- The number that lands is **~$110–130**. Not the architecture.
