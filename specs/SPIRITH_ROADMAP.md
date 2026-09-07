# Spirith — Roadmap

Where Spirith would go after the hackathon, if the project shows enough potential and draws
enough interest to continue. None of this is committed work; it is the direction, written down
so the choice to continue can be made on something concrete.

## In plain language

Every website you visit has a name like `google.com`. That name is not owned, it is rented. A
company called a registrar rents it to you for about twelve dollars a year, and a big
organisation called ICANN oversees the whole rental system. This system is called DNS, the
Domain Name System. When you type a name, DNS looks up which computer it points to, like a phone
book. If you stop paying rent, the name goes back on the market and somebody else can take it.
Your website, your email and anything that pointed at that name simply break.

ENS, the Ethereum Name Service, is the same idea rebuilt on the Ethereum blockchain. Names end
in `.eth`, like `alice.eth`. The difference is who runs the phone book. With DNS, the book is
kept by companies and one person has to remember to pay the bill. With ENS, the book is a
program on the blockchain that anyone can read and nobody can secretly edit. You still pay rent
for a `.eth` name, but the key point is that the rent can be paid by anyone, including another
program. That is what Spirith does. It holds money for a name and pays the rent automatically,
forever, so no human has to remember.

Now the files. A website's pictures and text normally live on one specific computer, a server,
and DNS points at that server. If the server dies or the bill goes unpaid, the files are gone.
IPFS works differently. Instead of naming a computer, it names the file by a fingerprint of its
contents, called a CID. Ask for that fingerprint and any computer in the world holding a copy
can hand it over. The fingerprint never changes, so nobody can swap the file for a fake one.

An NFT is a blockchain record that says "token number 24 belongs to Alice" plus one web address
where its picture and description live. That address is the weak spot. Most NFTs point at a
plain `.com`, so the artwork lives or dies on one person's twelve-dollar-a-year bill. A
well-built NFT points at the fingerprint instead, and then the only remaining job is making
sure at least one computer keeps a copy. That costs cents a year, but somebody still has to
pay, and nobody remembers to.

Spirith's idea is the same in every case: find the bill nobody remembers, and set up the
standing order. First the `.eth` name. Then the copy of the files. Last, for the old contracts
that can never be changed, the `.com` itself.

## The thesis, in one line

Permanence has an invoice, and nobody set up the standing order. There are three such
invoices, and Spirith pays each of them the same way: a per-item endowment, a payment anyone
may trigger, two exits for the money, and a runway everyone can see. Phase 1 pays the `.eth`
name and is the finished product for that bill. Phase 2 pays for the copy of the bytes an NFT
points at. Phase 3 pays the `.com` for the contracts that can no longer be changed.

## Phase 2 — File permanence (→ HANDOVER §10)

Paying for storage is permissionless and contract-payable, like an ENS renewal and unlike a
DNS lease, so the runway mechanic transfers directly. A permanent collection points its
`tokenURI` straight at an `ipfs://` fingerprint, which every marketplace fetches itself and
which can never expire or be forged. The one remaining bill is keeping a copy pinned, and that
is what the Phase 2 endowment pays.

- **The bytes are the cheap, solved part.** Filecoin Onchain Cloud gives streaming payments
  that pause when storage proofs stop, at about $2.50 per TiB-month. The endowment pays that
  stream per collection, publicly, and anyone can top it up.
- **A liveness oracle**: walk any contract's `tokenURI`, follow every hop, hash the bytes, and
  publish whether the NFT is still actually there. Read-only, works on anyone's collection,
  and produces the strongest visual this project has: a wall of blue-chip names with red scores.
- **Mint-funded perpetual care**: a fraction of every mint goes into that token's storage fund
  at the moment of sale. The collector never decides, the artist never sets a reminder, and the
  collection reaches mint-out already funded. This converts the pitch from charity into
  infrastructure, and it is the business.

## Phase 3 — DNS domains, for legacy contracts (→ HANDOVER §11)

The same endowment, applied to the `.com` that a decade of immutable `tokenURI`s still
hard-codes. ENS renewal is permissionless and ERC-20-payable; DNS renewal is neither, and a
smart contract cannot be a registrant. So Phase 3 is honest about trust rather than pretending
to remove it:

- **Prepay ten years at registration, endow the renewal, and name the caretaker.** One human
  action every few years, funded and alerted by the endowment. Long term this is a foundation,
  the way archives have always worked.
- **Host nothing.** DNSLink turns a domain into two DNS records pointing at content-addressed
  files; the recurring cost collapses to registration plus zone hosting, which is free.
- **Anchor ownership on-chain** by importing the DNSSEC-signed domain into ENS and publishing
  the expected zone hash, so a hostile registrar is detected within the hour even if it cannot
  be prevented. In ENSv2 the `.com` can alias the endowed `.eth` and inherit its records,
  including the funding status.
- **The escape hatch is the product:** an on-chain fallback registry mapping
  `(chain, contract)` to the canonical frozen-metadata CID. Today a dead `tokenURI` gives
  wallets and marketplaces nowhere to look. Nobody has built this; it is small.
- **The missing primitive:** a `renew(domain, years)` service behind an HTTP 402 paywall that
  accepts USDC, calls a registrar API and writes the receipt on-chain. No contract on earth can
  renew a domain today. This is a standalone project in its own right, and it lives outside
  `SpirithVault`, whose two exits never include a registrar API.
- **A migration tool** that rebuilds a collection's entire URL space as a static tree from the
  chain alone, so the mirror can be regenerated forever without the artist or their hosting.

First patient: the author's own collect-code / EUCLID collection, immutable, SVG-only, and
therefore unusually easy to freeze (→ HANDOVER §11.6).

## Protocol developments (any phase)

- **Switchable yield adapters, per name.** Today one `IYieldAdapter` is an immutable of the
  vault. Next: a registry of approved adapters, each endowment recording which one holds its
  excess, and a `switchAdapter(label, to)` that withdraws the name's position from one venue
  and deposits it in another in a single transaction, never leaving the earmark. Open design
  question: who may switch, the patrons by share-weighted vote, the name owner, or a keeper
  acting on the optimiser's recommendation. The load-bearing rules hold throughout: no admin
  key over funds, per-name isolation, reserve floor kept liquid during the switch.
- **Adapter list and simulation in the dashboard.** The name card lists available adapters
  with venue, rate range and risk notes, and lets a patron simulate the funded-until range under
  each before choosing; the agent's `optimalCadence` takes the adapter as an input.
- **Liquidity-aware renewal fallback.** If the yield venue cannot pay out on renewal day, renew for the longest block the liquid reserve covers instead of failing (→ HANDOVER §4.1, known gap). A `refreshRecord(label)` that rewrites `spirith.funded-until` without a money movement belongs with it.
- **Real yield on mainnet.** `ERC4626Adapter` over Aave's USDC token, already proven on a
  mainnet fork in Phase 1; mainnet deployment waits for ENSv2 mainnet.
- **Aave Stable Vaults** once their accounting chain reaches Ethereum: a contractually fixed
  rate is what lets the UI quote a date instead of a range (→ HANDOVER §4.2).
- **Subregistry endowments**: one earmark covering an artist's whole subname tree.
- **Endow as a gift**, by email, for someone without a wallet.

## Partners and funding

Programs that fund what Spirith builds, as they stood on 2026-09-07. Hackathon prizes are in
HANDOVER §9.2; this list is for the company.

| Partner | Program | Why Spirith fits |
|---|---|---|
| **ENS** | Ecosystem Working Group grants for ENS-centric builders; the Service Provider Program (SPP3 committee seated May 2026, ~$3.25M budget; future seasons run by the ENS Foundation) | Namespace liveness and renewal infrastructure is a service to the whole namespace. SPP is the long game, a grant the first step. |
| **NameHash Labs** | ENS referral program, off-chain payments to mainnet referrers | Every renewal already carries Spirith as referrer (→ HANDOVER §7). Revenue, not a grant. |
| **Filecoin Foundation** | Grants up to $50k for novel ideas, $5k–$10k next-level grants; Filecoin Onchain Cloud on mainnet in 2026 | Phase 2 generates paid on-chain storage deals, which is the Foundation's stated 2026 KPI. |
| **Ethereum Foundation** | Ecosystem Support Program, rolling: small grants to $30k, project grants $10k–$500k | The fallback registry and the liveness oracle are public goods with no token and no treasury. |
| **The Graph Foundation** | Ongoing grants for subgraphs, tooling and dapps | The liveness index across real collections extends the hackathon subgraph. |
| **Arweave / Forward Research** | Founder Residency for builders on Arweave | Closest philosophical relative: pay once, endowed storage. A second bytes backend for Phase 2. |
| **Aave** | Grants DAO status uncertain since the January 2024 renewal vote; ecosystem funding now flows through milestone proposals to Aave Labs | Treat Aave as the yield venue (`ERC4626Adapter` over the USDC token), not as a funder. |

Distribution partners rather than funders: mint platforms (Art Blocks, fxhash, Zora,
Manifold, Highlight) for mint-funded care, and pinning services (Pinata, Storacha, Filebase)
for the bytes. Each is a conversation, not a program.
