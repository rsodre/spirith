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

**Phase 2+ (post-hackathon):** The same endowment mechanism extended to DNS domains, then to the files those domains point at. See §10–12.

### The problem statement (use verbatim in the submission)

> We built machines that remember forever and hung them on hooks that have to be paid for every year. Ethereum will hold your token until the sun burns out; the name it answers to dies after 28 days of silence. Everything we call permanent is rented — the name, the record, the link an immutable contract can never be taught to forget — and the rent falls due on a calendar nobody is watching, charged to a card somebody stopped checking. Nothing breaks loudly. There is no revert, no failed transaction, no alert. The name simply stops resolving, and the thing behind it remains perfectly intact, perfectly addressed, and permanently unreachable. This is not a storage problem. Permanence has an invoice, and nobody ever set up the standing order.

### The insight that makes it work

**ENSv2 `renew()` is callable by any account, and accepts ERC-20 payment.**

That single fact means the endowment contract never takes custody of the name. It holds money and pays a bill that anyone is allowed to pay. No approvals over the name, no wrapping, no transfer of ownership. Compare with DNS, where permanence requires handing someone a registrar login — which is exactly why ENS is Phase 1 and DNS is Phase 2.

**Positioning line:** *We custody money. We never custody the name. The worst thing that can happen to a user is losing their deposit. It is structurally impossible for them to lose their identity.*

---

## 2. Verified facts (with sources)

These were confirmed from primary docs during planning. Do not re-derive; do re-verify anything marked ⚠️.

### ENSv2 ETH Registrar
Source: https://docs.ens.domains/ensv2/eth-registrar

```
commit(commitment)                                            // min 60s wait
register(label, owner, secret, subregistry, resolver,
         duration, paymentToken, referrer)
renew(label, duration, paymentToken, referrer)                // callable by ANY account
```

- **Payment is ERC-20 via `safeTransferFrom`.** Caller must `approve` the registrar for the total cost first. Payment flows to an immutable beneficiary address.
- `isPaymentToken(token)` — check which tokens are accepted.
- `getRegisterPrice(label, duration, paymentToken)` — stateful on the registrar, stateless on the oracle.
- Price oracle: **`StandardRentPriceOracle`** — length-based pricing, duration discounts, premium decay.
- **There is a `referrer` parameter on both register and renew.** See §7 for why this matters enormously.

### ENSv2 pricing
- 3 chars: **$640/year**
- 4 chars: **$160/year**
- 5+ chars: **$8/year**
- Multi-year discounts: **12.5% @ 2y, ~31% @ 3–5y, ~44% @ 6y**
- Recently-expired names carry a premium decaying exponentially over 21 days

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

## 3. ⚠️ Open questions — resolve these on Day 1

These change the architecture. Do not build past Day 1 without answers. Ask in the ETHOnline Discord ENS channel and read the deployed contracts.

1. **Is USDC an accepted `paymentToken` on the ENSv2 Sepolia deployment?** Call `isPaymentToken(USDC_SEPOLIA)`. If not, which tokens are? Everything downstream assumes a stablecoin.
2. **Do multi-year discounts apply to `renew()`, or only `register()`?** The docs say "registrations." If renewals don't get the discount, the cadence optimiser (§6) and the ~$100 headline number both change. This is the single highest-value question on the list.
3. **Is there a `getRenewPrice(...)`?** Docs only name `getRegisterPrice`. Find the renewal price accessor.
4. **Does `referrer` earn anything?** Is there a referral revenue share, now or planned? If yes, Spirith has a native business model (§7).
5. **ENSv2 Sepolia deployment addresses** — registrar, oracle, registry, resolver. Get them from ENS docs/Discord, do not guess.
6. **Renewal window** — how early before expiry can `renew()` be called? Needed for keeper logic.

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

**Sketch:**

```solidity
struct NameEndowment {
    uint256 totalShares;        // yield-adapter shares held for this name
    uint64  lastRenewedAt;
    uint64  expiryCache;        // last known registrar expiry
}

mapping(bytes32 labelHash => NameEndowment) public endowments;
mapping(bytes32 labelHash => mapping(address patron => uint256 shares)) public patronShares;
mapping(bytes32 labelHash => mapping(address patron => uint64 withdrawRequestedAt)) public notices;

function endow(string calldata label, uint256 amount) external;
function requestWithdraw(string calldata label, uint256 shares) external;
function executeWithdraw(string calldata label) external;      // after NOTICE_PERIOD

/// @notice Permissionless. Anyone may call. Caller receives a capped tip.
function renew(string calldata label, uint64 duration) external;

function runwayOf(string calldata label) external view
    returns (uint64 fundedUntilTimestamp, uint256 balance, uint64 optimalDuration);
```

**`renew()` flow:**
1. Read price from the registrar/oracle for `(label, duration, USDC)`.
2. Require the name is inside its renewal window.
3. Redeem exactly `price + tip` from the yield adapter into USDC.
4. `USDC.approve(registrar, price)`.
5. `registrar.renew(label, duration, USDC, SPIRITH_REFERRER)`.
6. Transfer `tip` to `msg.sender`. **Tip must be capped** — `min(bps * price, TIP_CAP)` — and paid from that name's own earmark, so keeper incentives cannot be farmed into draining a vault.
7. Update the resolver record and emit `Renewed`.

**Reserve buffer:** keep N years of renewals as liquid USDC in the vault; only the excess is deployed to the yield adapter. **A name's survival must never depend on an external system being available on the day it is due.** This principle recurs in every phase of this project.

### 4.2 `IYieldAdapter`

```solidity
interface IYieldAdapter {
    function deposit(uint256 assets) external returns (uint256 shares);
    function redeem(uint256 shares) external returns (uint256 assets);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function ratePerAnnumBps() external view returns (uint256); // for runway projection
}
```

Ship **three** implementations:

1. **`MockYieldAdapter`** — deterministic, configurable rate. **This is what the live demo runs on.** It cannot break on stage.
2. **`ERC4626Adapter`** — generic wrapper. Works with Aave v3 supply, sDAI, Savings GHO, Morpho vaults, Aave Stable Vaults. **Write to ERC-4626, never to a specific protocol.**
3. Optionally a thin `AaveStableVaultAdapter` if time allows.

**Prove the real one with a Foundry mainnet-fork test.** A fork test showing a real deposit, real accrual, and a real renewal paid from yield is far more convincing than a testnet mock, and costs an afternoon. Put it in the README.

**Yield venue guidance (decided):** for v1, **same-chain beats fixed-rate**. Use a plain ERC-4626 stablecoin vault on Ethereum. Aave Stable Vaults were evaluated and deferred — their accounting chain is **Arbitrum** with earning on Ethereum mainnet, which reintroduces exactly the cross-chain dependency this project deliberately avoids. Their two-step withdrawal (request → execute) and the fact that **the interest portion gates against system surplus while only principal is unconditionally redeemable** also complicate a perpetuity claim. Revisit when their accounting reaches Ethereum, or when Namechain forces multi-chain anyway. The fixed rate is a genuinely good reason to come back — it is what would let the UI quote a *date* instead of a *range*.

### 4.3 Resolver record

Write the funding status onto the name itself via the ENSv2 **PermissionedResolver**:

```
spirith.funded-until = <ISO year or unix timestamp>
spirith.patrons      = <count>
```

This is what makes it composable: any wallet, marketplace or resolver can see a name is endowed without asking Spirith anything. It is also the cleanest possible justification for the ENS track — ENSv2 features are *central*, not decorative.

Also explore **EnhancedAccessControl**: define a `RENEWER` role, and use **subregistries** so one endowment can cover an artist's whole subname tree.

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

**Agent tools (over Subgraph MCP):**
- `namesAtRisk(days: int)` — ranked by value and time-to-death
- `runway(name)` — projected funded-until, with the rate assumption stated
- `optimalCadence(name)` — recommended renewal duration and why
- `portfolioHealth(address)` — "which of my names dies first?"
- `rescueProposal(name)` — how much is needed, what it buys

Keep an on-chain heuristic in the contract (longest affordable duration above a reserve threshold) and let the agent do the sophisticated version off-chain. The contract must never depend on the agent.

---

## 7. The `referrer` parameter — possible business model

`renew(label, duration, paymentToken, referrer)` takes a referrer on every call.

Spirith passes itself as referrer on **every renewal it ever executes**. If ENS pays referral rewards, the protocol earns a cut of every renewal it keeps alive, forever — funding keeper tips and the public dashboard **without a token, a fee switch, or a rent-seeking layer**.

A self-funding public good is a far better answer to *"how does this sustain itself?"* than anything you would otherwise invent. **Verify whether referrers actually earn a share (§3.4). If they do, it gets a slide.**

---

## 8. Economics

Using confirmed ENSv2 pricing:

| Name length | List price/yr | Effective/yr @ 6y (~44% off) | Perpetual endowment @ ~4% real |
|---|---|---|---|
| 5+ chars | $8 | ~$4.50 | **~$110** |
| 4 chars | $160 | ~$90 | ~$2,250 |
| 3 chars | $640 | ~$358 | **~$9,000** |

**Headline: ~$110, once, makes a normal `.eth` name immortal.**

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
| **ENS** | Track 1 — Best Use of ENSv2 (Sepolia) | $4.5k (1st $1.5k) | ERC-20 renewal path, PermissionedResolver liveness record, EnhancedAccessControl renewer role, subregistries. Central, not decorative. |
| **The Graph** | Track 2 — Best AI Tooling (From Scratch) | $5k (1st $2.5k) | Subgraph MCP is load-bearing; the cadence optimiser is real work on live data; net-new. |

**THIRD SLOT — leave empty until the unpublished tracks land.** Two deeply integrated sponsors beat three with one bolted on. Candidates in order:

1. **Privy** ($5k, track unpublished) — if it's about onboarding: *"endow someone's name as a gift, by email, no wallet required."* Best remaining story, on Ethereum, no detour.
2. **Uniswap Foundation** ($5k) — **only** for the *Endowment Hook*: an opt-in v4 hook routing a basis point of a pool's fees into keeping that project's ENS name alive forever. A DAO's own trading activity funds its own identity. Genuinely novel, but the largest remaining scope. Requires `FEEDBACK.md` + their developer feedback form.
3. **Chainlink** ($3k, unpublished) — Automation as a belt-and-braces renewal trigger. Safe, small, and **slightly redundant** because the tip already funds the keeper. You would have to admit that onstage.

**Do not add a sponsor unless it passes this test: would you use it if there were no prize?**

### 9.3 8-day plan

| Day | Date | Goal |
|---|---|---|
| 1 | Sep 5–6 | Resolve all §3 open questions. Scaffold Foundry + Next.js. Get ENSv2 Sepolia addresses. Register a test name, call `renew()` manually from a script to prove the path. |
| 2 | Sep 7 | `SpirithVault.sol` core: endow / withdraw+notice / per-name earmarks / patron shares. Full unit tests. |
| 3 | Sep 8 | `renew()` path end-to-end on Sepolia with `MockYieldAdapter`. Keeper tip. Resolver record write. |
| 4 | Sep 9 | `ERC4626Adapter` + **Foundry mainnet-fork test** against real Aave. Cadence heuristic on-chain. |
| 5 | Sep 10 | Subgraph deployed and indexing. Entities + derived views. |
| 6 | Sep 11 | Agent (Subgraph MCP tools) + dashboard: namespace scoreboard, name card, endow flow. |
| 7 | Sep 12 | Polish. README (custody posture first). `FEEDBACK.md` if Uniswap. Rehearse demo 3×. |
| 8 | Sep 13 AM | **Record video. Submit by 10:00 EDT** — two hours of margin, not zero. |

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

## 10. Phase 2 — DNS domains

**Why it's Phase 2 and not Phase 1:** ENS renewal is permissionless and ERC-20-payable. DNS renewal is neither. A `.com` is a lease from a registry administered by an ICANN-accredited registrar held by a legal person. **A smart contract cannot be a registrant.** There is no trustless version.

### 10.1 The three roles (keep them separate — conflating them is the classic mistake)
1. **Registrant** — the legal person on the lease. Cannot be a contract.
2. **DNS operator** — whoever serves the zone. A *different* account, and free (Cloudflare, or the registrar's nameservers). Holds two records.
3. **Payer** — the endowment. This is the only one that can be a contract.

### 10.2 Payment options, ranked
1. **Prepay 10 years** at registration. Most gTLDs allow it. One human action, then a decade of nothing. **For production this is genuinely the correct answer** and saying so onstage reads as rigour, not evasion.
2. **Mainstream registrar API + stablecoin card.** Namecheap / Dynadot / Porkbun have APIs with prepaid account balances. Fund the balance from a USDC-backed card (Gnosis Pay, Kast, etc.). An agent watches expiry and fires renewals. Chain: USDC → card → registrar balance → renewal. Ugly, real, unattended.
3. **Crypto-accepting registrars.** Njalla (BTC/LTC/XMR/DASH), 1984 Hosting, OrangeWebsite, Virtualine. Almost all BTC/Monero, essentially none take USDC, none has a renewal API. ⚠️ **Njalla registers as owner-of-record on your behalf** — a trust hole that is unacceptable in a permanence product.
4. **Build the missing primitive: an x402-gated `renew()` service.** A small service exposing `renew(domain, years)` behind HTTP 402, accepting USDC, calling a registrar API, writing the receipt on-chain. **No smart contract on earth can currently renew a domain.** This is a genuine gap, not a hack — and a strong standalone hackathon project.

### 10.3 Hosting: you mostly don't
**DNSLink** removes the server entirely:

```
_dnslink.example.com   TXT    dnslink=/ipfs/bafy…
example.com            CNAME  <DNSLink-aware gateway>
```

Recurring cost collapses to **registration renewal + two DNS records**. DNS hosting is free.

- ⚠️ **Content-type gotcha:** extensionless files get sniffed and served as `text/plain`. Use a root `_redirects` file to rewrite `/path/metadata` → `/path/metadata.json` with a 200 rewrite, so the extension exists on disk while the URL stays identical.
- Gateways churn. Treat the gateway as swappable (one CNAME). The endowment can run its own DNSLink gateway on **Akash** or **4EVERLAND**, both of which accept on-chain payment for compute.
- Query strings: IPFS gateways ignore unknown query params (`v`, `hash`, `formula`, `resolution` are not reserved) — so a static file at the exact path answers correctly. ⚠️ Verify against the chosen gateway.

### 10.4 Anchoring ownership
ENS supports importing a **DNSSEC-signed** `.com` into ENS, including a **gasless offchain path**. This doesn't renew the registration — nothing on-chain can — but it makes ownership and the canonical CID provable from a contract, and gives a pointer that survives a hostile registrar.

Publish the expected DNS records + zone hash on-chain so any tampering is detected within the hour. You cannot prevent a custodian going rogue; you can make it loud.

### 10.5 The escape hatch — the real Phase 2 product
Because an immutable `tokenURI` hard-codes a domain, **if the domain is lost, that URL is dead forever.** So build redundancy:
- `<project>.eth` contenthash → root CID
- bare `ipfs://<rootCID>/<path>`
- **An on-chain fallback registry:** `(chain, contract) → canonical frozen-metadata CID`, versioned and attested.

Today when a `tokenURI` 404s, every marketplace and wallet shows a broken image and gives up — there is *nowhere to look*. A public fallback registry is a small contract, an obvious idea, and nobody has built it. **This is the protocol contribution of Phase 2.**

### 10.6 Name the caretaker
Roughly one human action every few years — renew, or swap a dead gateway. The system's job is ensuring that person exists, is funded, and is alerted. Long term this is a foundation, the way archives have always worked. **Pretending it is fully autonomous is the lie that kills these projects.**

---

## 11. Phase 3 — File permanence

### 11.1 Infrastructure already exists (this is not the hard part)
- **Filecoin Onchain Cloud** (shipped late 2025) — **Filecoin Pay** gives streaming smart-contract payments to storage providers that settle per epoch, and **payment pauses automatically when storage proofs stop arriving**. Warm Storage ≈ **$2.50/TiB/month**. **Synapse SDK** is a normal JS upload/retrieve/pay API. **Filecoin Pin** bridges IPFS CIDs. *Use this. Do not run a node.*
- **Arweave** — endowment model, pay once, funded on a declining-storage-cost assumption. Closest philosophical relative.
- **Swarm** — postage stamp batches drain at the network price and data expires unless topped up. **Your runway mechanic already exists here** — just private, per-batch, and invisible.

**The gap Spirith fills:** nobody has made the runway a *social object* — public, priced, collectively rescuable. It is a design problem, not an infrastructure problem.

### 11.2 The endowment covers three lines, not one
1. **Bytes** — Filecoin/IPFS, ~$2.50/TiB/month
2. **Name** — registrar renewal, ~$12/year, the only irreducibly web2 line item
3. **Route** — the DNSLink record and a live gateway

**The domain costs ~200× more than the art.** Everything the industry talks about — decentralised storage, content addressing — is the cheap, solved part. What actually kills collections is a $12 annual invoice on one person's card.

### 11.3 The liveness oracle
An agent that walks a contract's `tokenURI`, follows every hop, fetches the bytes, hashes them, and compares against a committed hash. Gives a public, verifiable answer to **"is this NFT still actually there?"** — and it works read-only on *anyone's* collection. Showing a wall of blue-chip NFTs with red liveness scores is the strongest visual this project has.

### 11.4 Case study: collect-code / EUCLID (Roger's own collection)

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

### 11.5 Mechanism variants (all discussed; pick per audience)
- **The Decaying Gallery** — files don't die, they degrade. Resolution drops as runway shortens; a top-up snaps it back instantly. Best demo of the set, and cheap to build (it's a render policy, not a storage trick).
- **Hostage NFTs** — per-file endowments; NFT points at an ENS name, not a CID. Empty endowment → resolver returns a tombstone → the collector's JPEG goes blank publicly. Exposes the real, uncomfortable truth: most NFTs are one unpaid invoice from nothing.
- **Attention Pays Rent** — every view costs half a cent (x402-metered) and every cent funds that file's endowment. Popular work funds its own immortality; forgotten work dies unless adopted. No token, no DAO, no death spiral.
- **Runway as a market** — share token redeemable against the treasury; a Uniswap v4 hook widens the mint discount as runway shortens, turning a doom loop into a coordination game. ⚠️ Weakest: the reflexivity (runway ↓ → price ↓ → harder to refill) is a death spiral a judge will find in ten seconds.
- **Mint-funded perpetual care** ⭐ — route $0.50 or 0.1% of every mint into that token's care fund at the moment of sale. The collector never makes a decision; the artist never sets a reminder; the collection reaches mint-out already funded. **This is the actual business.** It converts the pitch from charity ("rescue dying art") into infrastructure ("every mint funds its own permanence, automatically, for 16¢").

---

## 12. Continuity strategy

**ENS, The Graph, Arc and Hedera all run continuity tracks** paying thousands specifically for extending an existing open-source project at a later event. Build Phase 1 clean, open and well-documented, and Phase 2 is not a roadmap slide — it is a **pre-qualified entry for the next hackathon.** Say so in the submission. Judges reward teams who will obviously still exist in six months.

---

## 13. Rejected — and why (do not re-propose)

| Rejected | Reason |
|---|---|
| **Arc (Circle L1)** | Forces a cross-chain bridge into a design with no reason to leave Ethereum. Reads as a prize grab, and the bridge is the most likely thing to break on demo day. Arc mainnet also wasn't live, ruling out their Track 3. |
| **1inch Aqua for the swap** | ENSv2's ERC-20 payment eliminated the swap entirely. Even before that, a vault swapping $8 once a year is a thin "Aqua app" — the Arc mistake at smaller scale. |
| **Hedera / World** | No honest role in Phase 1. Both are strong for Phase 2/3 (x402 renewal service, HCS attestations, proof-of-human patronage) — revisit then. |
| **Aave Stable Vaults for v1** | Accounting chain is Arbitrum; same cross-chain objection as Arc. Two-step withdrawal; interest gated against system surplus. Deferred, not dismissed — the fixed rate is the one thing that would let the UI quote a date instead of a range. |
| **A Spirith token / DAO treasury** | "Token price tracks remaining runway" is a reflexive death spiral, and a single global treasury makes the blast radius the whole archive. Per-name earmarks instead. |
| **Any cross-chain hop on the renewal critical path** | A name's survival must never depend on a bridge being up on a particular Tuesday. |
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

**Prior art**
- self-repaying-ens — https://github.com/The-Wary-One/self-repaying-ens
- rescue-name — https://github.com/v3xlabs/rescue-name

**Yield**
- Aave Stable Vaults — https://aave.com/docs/vaults/stable-vaults (+ `/architecture`, `/yield-strategies`)

**Storage / Phase 3**
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
- Put the limitations on a slide, not in a footnote: yield is a forecast; there is a caretaker role in Phase 2; testnet yield is theatre.
- Cite the 2022 prior art before a judge finds it.
- The number that lands is **~$110**. Not the architecture.
