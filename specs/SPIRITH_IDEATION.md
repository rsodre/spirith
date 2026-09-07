# Spirith — Design Conversation Transcript

**Participants:** Roger · Claude (Opus 5)
**Exported:** 2026-09-05
**Context:** Ideation for ETHGlobal ETHOnline 2026. This excerpt begins at the moment the storage-endowment concept was first raised, and runs through to the naming of the project as **Spirith** and its one-line pitch.

---

## Roger

Let's talk about this idea for the ETHOnline hackathon. Hosting or pinning files forever is hard, if not impossible. IPFS is a great concept (any of the sponsors offers it? or something similar?) but we have to keep paying to host a node or paying pinning service for our files to be alive. What if artists paid a fee (minimum or based on the amount of data they store) and their files will live forever. The service hosts an IPFS node, and the community (artists and collectors) have to keep the service alive by adding cash (buying tokens) when it's running down. Price of tokens are co-related to the remaining time the treasury have alive. if treasury runs out, the service stops working and all files are lost. but collectors and artists don't want that.... That would require an automated payment to the hosting (in crypto), automated scaling, and a DAO to maintain it (by token ownership). Does something like this exist? Does infra to host something like this exist? Elaborate this idea in the context of this hackathon, giving a few variants.

---

## Claude

Short answer: **the infrastructure exists and is basically solved. The economics you're describing don't exist. That's your project.**

### What already exists

**Arweave** is the closest thing to your goal and it works the opposite way: you pay once, and that payment funds a 200-year endowment. Storage costs fall over time, so the endowment outruns the bill. Pay-once-store-forever, no community, no drama, no death.

**Swarm** already has your exact runway mechanic. You buy a "postage stamp batch" with BZZ, it drains continuously at the network price, and when it hits zero your data expires. You top it up to keep it alive. So the "files die if the money runs out" primitive is shipped and running — it's just private, per-batch, and invisible. Nobody has ever made it a *social object*.

**Filecoin Onchain Cloud** (shipped late 2025) is the piece that makes your idea actually buildable in 13 days. Filecoin Pay gives you streaming smart-contract payments to storage providers that settle per epoch — and critically, **payment pauses automatically when proofs of storage stop arriving.** Warm Storage runs ~$2.50/TiB/month, the Synapse SDK is a normal JS upload/retrieve/pay API, and Filecoin Pin bridges IPFS CIDs into it. So "automated payment to hosting, in crypto, with proof it's still alive" is a library call now. You do not need to run a node or write a keeper.

**What doesn't exist:** a *collective* endowment where the remaining runway is public, priced, and emotionally load-bearing. Nobody has made "how long until this art disappears" a number people can see and act on. That's the gap, and it's a good one — it's a design problem, not an infra problem, which is exactly what wins hackathons.

### The flaw in your version, before you build it

"Token price correlates with remaining runway" is a death spiral. Runway drops → price drops → refilling is harder → runway drops faster. Someone can short it and watch. And "if the treasury dies, *everything* dies" makes the blast radius the whole archive, which means one bad month kills a thousand artists. Two fixes worth knowing: make endowments **per-file** so failure is local, and consider making rescue *cheaper* as death approaches (a discount that grows with urgency) rather than more expensive — it turns a doom loop into a coordination game where the archive gets bought back at the bottom.

---

### Variant A — The Decaying Gallery

**The hook:** files don't die, they *degrade*. As a work's runway shortens, the served image loses resolution — 4K, then 1080, then a blurry 240px ghost, then black. Top it up and it snaps back to full fidelity, instantly.

This is the best demo in any of these ideas. A slider showing "3 months left," an image visibly rotting on screen, a $5 USDC payment, and it's sharp again. It's also cheap to build — you serve derivatives, the decay is a render policy, not a storage trick.

- **Arc (Circle)** — Track 1, Best DeFi Stablecoin-Native Pool ($2.5k): the endowment *is* a USDC pool, streaming out to Filecoin Pay, with Paymaster so patrons never touch gas.
- **The Graph** — Track 2, AI Tooling from Scratch ($5k): index runway per file, and run a curator agent that surfaces the "endangered list" and warns patrons before decay starts.
- **Hedera** — Track 1 or 3 ($2k×3): HCS as the tamper-proof log of every storage proof and every rescue, so the artwork carries a permanent record of who kept it alive.

### Variant B — Hostage NFTs

**The hook:** your NFT is a link, and links die. This makes the link the asset.

Every work gets an ENS name that resolves to its current CID. The NFT points at the name, not the file. If the endowment empties, the resolver returns a tombstone and the collector's JPEG goes blank — publicly, on OpenSea, in their wallet. Collectors can top up, and patronage is recorded on the artwork itself.

The uncomfortable truth this exposes is the pitch: **most NFTs today are already one unpaid Pinata invoice away from being nothing.** You're not inventing the risk, you're making it visible and fixable.

- **ENS** — Track 1, Best Use of ENSv2 ($4.5k): permissioned resolver as the liveness layer, namespace aliasing so a CID can migrate storage backends without breaking a single link. Permanent *names* over impermanent files is a genuinely strong ENSv2 argument.
- **Arc** — Track 2, Agentic Economy ($2.5k): per-file endowments, streaming settlement, one-click rescue.
- **The Graph** — Track 1 ($5k): a subgraph of every work's health, powering a "graveyard" page of art that already died.

### Variant C — Attention Pays Rent ← my pick

**The hook:** every view costs half a cent, and every cent goes into that file's storage endowment. Popular work funds its own immortality. Forgotten work dies — unless a patron adopts it.

No token. No DAO. No death spiral. It's darwinian and it explains itself in one sentence, and it's the same denominator-swap move you liked in MemeFi: attention, which is worthless, becomes the funding rail for permanence, which is expensive.

- **Hedera** — Track 1, AI & Agentic Payments ($2k×3): x402-gated retrieval is *exactly* the primitive. Each view is a real paid request through the Blocky402 facilitator. HCS logs the flow. Genuinely load-bearing, not bolted on.
- **Arc (Circle)** — Track 2 ($2.5k): nanopayments make half-cent views economically real, USDC per-file escrow streams to the provider.
- **The Graph** — Track 2 ($5k): the agent that runs the endangered list — computes months-of-life for every file, ranks what's about to be lost, and pitches it to collectors.

**The stage moment:** show a wall of art where each piece has a countdown. One is at 11 days. You open it in a browser, and 40 people in the audience opening it too pushes the counter to 3 months, live.

### Variant D — Runway as a market

Your original design, done carefully. Share token redeemable against the treasury, so price has a floor and naturally tracks runway. A Uniswap v4 hook makes the mint discount widen as runway shortens — the closer to death, the better the deal for whoever saves it.

- **Uniswap Foundation** — Track 1 ($1k×3): dynamic-fee/mint hook driven by treasury runway. Unusual use of a hook; they'll notice.
- **Arc** — Track 1, Stablecoin-Native Pool ($2.5k).
- **The Graph** — Track 1 ($5k): runway oracle and dashboard.

Weakest of the four in my view — the most mechanism, the least story, and a judge will poke at the spiral within ten seconds.

---

**Two practical notes.** None of the eleven sponsors sells storage — no IPFS, no pinning. Hedera has HCS for logging and small-file service, but your actual bytes go to Filecoin or Arweave or Swarm, none of whom are paying prizes here. That's fine, but it means your three sponsor integrations have to carry real weight in the *economics* layer, not the storage layer. Use Synapse SDK and don't run a node.

And preempt the obvious judge question — "isn't this Arweave?" Your answer: Arweave sells permanence to one payer at upload time. This sells permanence as something a community renews, watches, and can rescue. Different product, and it works on top of Arweave rather than against it.

---

## Roger

something very important I forgot to add... part of the pool is destined for domain name maintenance. Say I have an immutable contract, and its metadata point to a domain name. we can't just port it to IPFS, we need to (at least) host the domain and redirect to the IPFS file. is there any registrar that allows automatic on-chain payments? how can we host that domain?

---

## Claude

Good catch — and it's the part that actually makes the project interesting, because it's where the whole "permanent" story breaks in real life.

### Is there a registrar with native on-chain payments?

**No.** Not one, and there won't be soon. ICANN accreditation requires a legal entity with fiat settlement, escrow obligations and KYC on the registrar side. Every "crypto domain registrar" is a normal registrar with a crypto checkout bolted on.

What actually exists, in descending order of usefulness:

**Crypto-accepting registrars.** Njalla (BTC/LTC/XMR/DASH), 1984 Hosting and OrangeWebsite (both Iceland, BTC/LTC/XMR), Virtualine. Almost all BTC/Monero, essentially none take USDC, and none has a renewal API you could call from a contract. Njalla has an extra problem: it registers domains *as owner of record on your behalf*, which is a trust hole you can't accept in a permanence product.

**Mainstream registrar API + a stablecoin card.** This is the path that works today. Namecheap, Dynadot and Porkbun all have APIs with a prepaid account balance. You fund that balance with a USDC-backed card (Gnosis Pay, Kast and similar), and an agent watches expiry dates and fires renewals. The chain of custody is USDC → card → registrar balance → renewal. Ugly, but it's real automation and it runs unattended.

**Prepay ten years.** Most gTLDs let you register up to 10 years forward in one transaction. Zero automation, zero counterparty, zero failure modes. For a *production* permanence system this is genuinely the correct answer, and you should say so on stage.

**The one that doesn't exist yet — build it.** A tiny service that exposes `renew(domain, years)` behind an x402 paywall: any contract or agent pays USDC over HTTP 402, the service calls the registrar API, and the receipt goes onchain. That's a missing primitive, not a hack. Right now no smart contract on earth can renew a domain. Yours could.

### How do you host the domain?

You mostly don't, and this is the good news. **DNSLink** means you need no server at all.

```
_dnslink.art.example.com   TXT    dnslink=/ipfs/bafy...
art.example.com            CNAME  <a DNSLink-aware gateway>
```

A DNSLink-aware gateway resolves the TXT record and serves the IPFS content under your domain. No VPS, no redirect service, no origin. The recurring cost of keeping an immutable contract's metadata alive collapses to **registration renewal plus two DNS records**, and DNS hosting is free at Cloudflare and most registrars.

The residual risk is gateway churn — public gateways come and go, and Cloudflare has walked back parts of its web3 offering before. Mitigate by treating the gateway as swappable (it's one CNAME) and by having the endowment able to run its own DNSLink gateway on Akash or 4EVERLAND, both of which *do* take on-chain payment for compute, if it ever has to.

**Anchor the ownership onchain:** ENS supports importing a DNSSEC-signed `.com` into ENS, including a gasless offchain path. So `example.com` becomes an ENS name you provably control from a smart contract, and its records live where your endowment logic already lives. That doesn't renew the registration — nothing does that onchain — but it makes ownership and the canonical CID verifiable, and it gives you a permanent pointer that survives a registrar going hostile.

### Why this makes the project better

You were building an endowment for *bytes*. It's actually an endowment for three things, and the other two are the ones everyone forgets:

1. **The bytes** — Filecoin/IPFS, ~$2.50 per TiB per month
2. **The name** — registrar renewal, ~$12 a year, the only irreducibly web2 line item
3. **The route** — the DNSLink record and a live gateway

And that gives you the demo. Build a **liveness oracle**: an agent that walks a contract's `tokenURI`, follows every hop, fetches the bytes, hashes them, and compares against a committed hash. Now you have a public, verifiable answer to *"is this NFT still actually there?"* — and you can point it at real, famous collections. A meaningful share of them resolve through a domain someone is quietly paying for, or an S3 bucket, or a pinning service on a lapsing credit card. Showing a judge a wall of blue-chip NFTs with red liveness scores and a countdown next to each is a much sharper pitch than "permanent storage for artists."

Call it **Lifeline**. The product is: measure the decay, then sell the fix.

**Sponsor fit shifts accordingly, and improves:**

- **ENS** — Track 1, ENSv2 ($4.5k): DNSSEC import of the real `.com` into ENS, permissioned resolver holding the canonical CID plus the domain's expiry plus fallback routes. ENS as the pointer that outlives the registrar is a strong, non-obvious ENSv2 argument.
- **Hedera** — Track 1 ($2k×3): the x402-gated `renew()` service — a real paid request that does something no contract can do today — with HCS as the attestation log of every liveness check and every renewal receipt.
- **The Graph** — Track 2, AI Tooling from Scratch ($5k): the liveness index across real collections and the agent that ranks what's closest to dying.

That drops Arc, which hurts a little. If you'd rather keep Circle, swap out The Graph and let Arc carry the endowment pool.

**One number for your slide:** a domain is ~$12/year. At a 4–5% real yield, that's a **~$250 endowment that renews it forever.** Storage for a typical art file is a rounding error next to that. The whole thesis fits in one line — *permanence isn't a technology problem, it's a $250 problem nobody set up a standing order for.*

---

## Roger

I like it! I'll give you a practical example. Tell me how I make this eternal. I have an erc721 collection on Ethereum and a sample tokenURI is:

`https://collect-code.com/api/token/euclid/24/metadata?v=1&hash=0x5e02e1fbfa57b69573a52bdb76da04b9&formula=pa1.bg0.ma0.tr03000.fx50.rn29.shC0inD14st000rn58.shT4frAA83inDC5st212rnB7`

It is hosted on my own Vercel account. the server generated the file on-the-fly. how can I bring it to our new service? can we still have a homepage at collect-code.com?

---

## Claude

Perfect test case — and you got lucky in a way that matters enormously.

I couldn't fetch your API (robots.txt blocks it), so paste me the metadata JSON when you can and I'll tighten the details. But the URL alone tells me most of what I need.

### The lucky part

**The seed is already immutable.** `formula=` is a complete deterministic description of artwork #24, and it's baked into a `tokenURI` on Ethereum that nobody can change. Your art is not at risk. What's at risk is only:

1. the **renderer** that turns that formula into pixels (lives on Vercel)
2. the **route** that gets a client from the URL to the renderer (DNS + Vercel)

That's a much smaller problem than "preserve N images forever," and it changes the whole approach. You should not archive pixels. You should archive **the machine that makes the pixels**, once.

### The bad news: DNSLink alone won't save this URL

IPFS gateways are path-addressed. `?formula=…` isn't something a gateway can act on. But look closer — **the path already identifies the token**: `euclid/24`. The query string is almost certainly redundant. So the fix is to reproduce your URL space as a **static directory tree** and pin the whole thing as one CID.

```
/index.html                              ← your homepage
/api/token/euclid/24/metadata            ← frozen JSON for #24
/api/token/euclid/24/image.png
/render/euclid.html                      ← the renderer, all JS inlined
/_redirects
```

Then one TXT record and the existing `tokenURI` resolves from IPFS, byte-for-byte, with no server anywhere:

```
_dnslink.collect-code.com  TXT  dnslink=/ipfs/bafy…rootCID
collect-code.com           CNAME  <DNSLink gateway>
```

**One real gotcha:** a file named `metadata` with no extension gets its content-type sniffed, and gateways will likely serve it as `text/plain`. Put a `_redirects` file at the root that rewrites `/api/token/euclid/:id/metadata` to `/api/token/euclid/:id/metadata.json` with a 200 rewrite, so the extension exists on disk while the URL stays identical.

### The migration, concretely

**1. Map the dependency graph first.** Your `tokenURI` is hop one. The JSON's `image` and `animation_url` are hops two and three, and if the renderer pulls p5.js or three.js from a CDN, that's hop four — and CDN links are the single most common cause of dead generative art.

**2. Freeze the renderer, not the output.** Build one self-contained HTML file for the `euclid` algorithm: every library inlined, zero network calls. ~100KB, pinned once, serves the entire collection forever at any resolution.

**3. Generate the tree from the chain, not from Vercel.** Read every `tokenURI` straight off the contract, parse the query params, and emit the static tree deterministically. **Anyone can rebuild your entire mirror from Ethereum alone, forever, without you and without Vercel.**

**4. Endow the domain.** Register ten years forward, DNSSEC-sign it, import into ENS, fund the renewal endowment.

**5. Add fallback routes that don't need DNS at all.** `collectcode.eth` contenthash → the same root CID; plus the bare `ipfs://bafy.../api/token/euclid/24/metadata`.

### Yes, you keep the homepage

Same CID, `/index.html`. The constraint is that it becomes **static-but-alive**: no server-side rendering, no API routes. Anything dynamic moves to client-side JS hitting a public RPC or a subgraph directly from the browser.

### One thing to check before any of this

Look at your contract for `setBaseURI`. A lot of collections described as immutable aren't. If you have one, point it at `ipfs://<rootCID>/` and the DNS problem evaporates entirely.

If it's genuinely immutable — **then collect-code is the perfect patient zero for the demo.**

---

## Roger

no setBaseURI :(. I still don't understand the registrar part, yield pays the yearly fee, but here is the domain parked? who's the DNS? the metadata makes it even more complex...

```json
{"name":"EUCLID #24","description":"**EUCLID CODE** is a generative art collection inspired by Euclid's Elements. Token **#24** of **1870**.","external_url":"https://collect-code.com/euclid/24","image":"https://collect-code.com/api/token/euclid/24/svg?resolution=1200&formula=pa1.bg0.ma0.tr03000.fx50.rn29.shC0inD14st000rn58.shT4frAA83inDC5st212rnB7&hash=0x5e02e1fbfa57b69573a52bdb76da04b9","background_color":"131313","attributes":[{"trait_type":"Fibonacci Block","value":5},{"trait_type":"Seed","value":"1C0"},{"trait_type":"Family","value":"Sol Metro"},{"trait_type":"Palette","value":"Metro"},{"trait_type":"Primary Shape","value":"Circle"},{"trait_type":"Shapes","value":2},{"trait_type":"Lines","value":"Thin"},{"trait_type":"Margin","value":"Thin"},{"trait_type":"Pattern","value":"Yes"}]}
```

---

## Claude

That metadata is actually **good news**. Let me clear up the registrar thing first, because you're right that I was hand-waving it.

### Who holds the domain, honestly

There are three separate roles, and I'd been mushing them together:

**The registrant** — the legal person whose name is on the lease. A `.com` is not property, it's a lease from Verisign administered by an ICANN-accredited registrar, and **a smart contract cannot be a registrant.** There is no trustless version of this. Anyone who tells you otherwise is selling a `.eth` and hoping you don't notice your `tokenURI` says `https://`.

**The DNS operator** — whoever serves the zone. This is a *different* account from the registrar, and it's free. It holds two records: a CNAME to a DNSLink gateway, and the `_dnslink` TXT.

**The payer** — the endowment. This is the only one that can be a contract.

So no, the domain isn't "parked" — parked means no records. It has a live zone pointing at a gateway that reads your TXT record and serves IPFS. There's just no server of yours anywhere in the path.

Given that, the design goal changes from *eliminate trust* to **make the trust small, prepaid, and loudly monitored**:

- **Prepay 10 years** at registration.
- **Endow the renewal** so the money is never the failure mode.
- **DNSSEC-sign the zone** and publish the expected records + zone hash onchain. You can't stop a custodian going rogue, but the liveness oracle notices within an hour and screams.
- **Name the caretaker role out loud.** Roughly one action every few years. Long term this is a foundation, the way archives have always worked. Pretending it's fully autonomous is the lie that kills these projects.

### The escape hatch is the real product

Because your `tokenURI` is immutable and hard-codes the domain, **if the domain is ever lost, that specific URL is dead forever.** So the art has to survive the URL's death by other routes:

- `collectcode.eth` contenthash → the root CID
- the bare `ipfs://bafy…/api/token/euclid/24/metadata`
- and the piece worth building: **an onchain fallback registry** mapping `(chain, contract) → canonical frozen-metadata CID`, versioned and attested.

Today when a `tokenURI` 404s, every marketplace and wallet just shows a broken image and gives up — there is nowhere to look. That's your protocol contribution.

### Your metadata makes this easier, not harder

- **`image` is an SVG.** Vector. `resolution=1200` is cosmetically irrelevant — one frozen SVG serves every size forever.
- **No `animation_url`.** No JS renderer to preserve, no p5.js from a CDN quietly rotting. This is the failure mode that kills most generative collections and you don't have it.
- **`attributes` and `background_color` are inline.**
- **`external_url` is decorative.**

One thing to verify: open a raw SVG and check for external font references or `<image href>`.

### The numbers, which are your entire pitch

1,870 tokens, ~300MB generously.

| | per year |
|---|---|
| Storage (Filecoin Warm, $2.50/TiB/mo) | **~$0.06** |
| Domain renewal | **~$12** |

**The domain costs two hundred times more than the art.** Endow it and you need roughly **$250–$300, once, forever.** Across 1,870 tokens that's **sixteen cents per token.**

Two honest caveats: stablecoin yields aren't guaranteed and `.com` renewal prices have been rising, so endow with a 2–3x margin.

### What you'd actually build

```
/index.html                            ← static homepage, reads chain client-side
/euclid/24/index.html                  ← external_url page
/api/token/euclid/24/metadata(.json)   ← frozen, byte-identical
/api/token/euclid/24/svg(.svg)         ← frozen vector
/_redirects
```

Generated **from the contract**, not from Vercel. Vercel becomes redundant rather than critical.

---

## Roger

the only problem using my collection: it's still open. we can only move to Liveness (I love that name!) once it's minted out and static

---

## Claude

That's not a blocker — and I think it actually makes the project better.

**Your collection isn't dynamic. It's a growing set of already-frozen things.** The moment token #25 mints, its `tokenURI` is fixed on Ethereum forever, formula and all. You don't have a moving target, you have an append-only list.

And DNSLink was built for exactly this. The TXT record is *meant* to be mutable — that's its entire purpose, a changeable pointer to unchangeable content. IPFS directories are Merkle trees, so adding one token gives you a new root CID while every existing file keeps its own CID and stays pinned.

### Two ways to run it while minting

**Shadow mode (what I'd do).** Leave DNS pointing at Vercel. Liveness runs alongside: watches mint events, freezes each new token within seconds, republishes the root CID, writes the attestation onchain. Zero risk to buyers mid-mint. At mint-out you flip it.

**Live cutover.** DNS points at the gateway now, TTL 60 seconds, watcher updates the TXT on every mint. There's a window between mint and propagation where a fresh buyer's metadata 404s — and a collector refreshing OpenSea on a blank NFT they just paid for is exactly the experience you don't want.

### The thing an open collection unlocks

If you're still minting, you can make **each mint endow its own permanence.** Route $0.50 — or 0.1% — of every mint straight into that token's care fund at the moment of sale. The collector never sees a decision, the artist never sets a reminder, and the collection arrives at mint-out already funded.

That's a perpetual-care fund, the same thing cemeteries have sold for a hundred and fifty years, applied to the one industry that sells "forever" and budgets for eighteen months.

And it fixes the pitch's weakest point. "Rescue dying art" is charity. "Every mint funds its own permanence, automatically, for 16 cents" is infrastructure.

### Why the demo gets better

A static collection means you demo a migration. An open one means you demo the **whole lifecycle, live**: mint a token on stage → Liveness catches the event → freezes the SVG and metadata → new root CID → attestation onchain → endowment auto-funded from the mint → liveness score goes green.

Then cut to the scoreboard: your collection at 100%, next to a row of blue-chip collections resolving through someone's expiring domain.

Two things and I can write the mirror generator: is the `tokenURI` string stored onchain per token, or built from an onchain seed? And the contract address and chain.

---

## Roger

let's condense the core idea in a way that is realistically easy to implement and present at the hackathon. Let's focus on liveliness for ENS names as Phase 1 (the hackathon) and move the domain as Phase 2 (post-hackathon), as a continuation proposal. ENS names will work exactly the same as domain names. You register, make a deposit on our contract, it generates yield, and once a year it renews automatically. We can accept any token, swapping to ETH or USD for the renewal. What's the most optimal selection of sponsors we can choose to target? Search the internet if you can find anything similar.

---

## Claude

Searched. Here's what's out there, and the sharpest version of Phase 1.

### Prior art (there is some, and it helps you)

**[self-repaying-ens](https://github.com/The-Wary-One/self-repaying-ens)** is the closest thing that exists — a 2022 Gitcoin Money Legos hackathon winner that auto-renews ENS names using Alchemix self-repaying debt, Gelato for automation, Curve for the alETH→ETH swap. Same instinct, financed differently: **debt** rather than **endowment**, one collateral type, mainnet-only, no monitoring layer, and it hasn't moved in a long time. v3xlabs also has a `rescue-name` tool in the expiring-names space.

Nothing shipped that is: non-custodial, multi-token, ENSv2-native, and paired with a public liveness layer. So you're not first to the thought, but you are first to the product — and citing the 2022 project onstage makes you look rigorous rather than derivative.

### The thing that makes this actually work

**ENS renewal is permissionless. Anyone can renew anyone's name.** ENSv2 docs even spell it out for expired names in the grace period: renewable "by anyone, not just the owner."

That single property is the whole design. Your contract never takes custody of the name, never needs an approval, never becomes a thing users must trust. It just holds money and pays a bill that anyone is allowed to pay.

**And a timely hook:** ENSv2 cut the grace period from 90 days to 28. The margin for human error just shrank by two thirds.

### Liveness, Phase 1

> **Deposit once. Your name renews itself forever.**

1. `endow(name, amount)` — pay in any token, converts to USDC, lands in a vault keyed to that specific name.
2. When the renewal window opens, **anyone** can call `renew(name)`. The contract pays the ENS fee and tips the caller. No keeper infrastructure required — the tip is the keeper.
3. The name publishes its own health as a text record through the ENSv2 Permissioned Resolver: `liveness.funded-until = 2149`.
4. A public dashboard scores the entire namespace.

**Scope call:** ship it as a **drawdown vault** with the yield adapter as a clean interface you demo but stub.

**The 90-second demo:** a Sepolia name with 3 days left, red on the dashboard. Deposit $20 of some random token. The text record updates, the card flips to *funded until 2149*. Trigger the renewal from a wallet that doesn't own the name — to prove anyone can.

### Sponsors — take these three

**ENS ($4.5k, Track 1)** — non-negotiable, and your ENSv2 usage is central rather than cosmetic.

**The Graph ($5k, Track 2 — AI Tooling from Scratch)** — an agent over Subgraph MCP that watches the live ENS namespace, ranks at-risk names, answers "which of my names dies first?"

**Arc / Circle ($2.5k, Track 1 — Best DeFi Stablecoin-Native Pool)** — the endowment vault is *literally* a stablecoin-native pool.

That's a $30k combined pool and a clean three-layer story: **identity, intelligence, money.**

**One risk to resolve on day one:** Arc Track 1 may expect deployment on Arc itself, while ENS lives on Sepolia — and cross-chain in 13 days is how hackathon projects die.

### Phase 2 is a strategic asset

Several of these sponsors run **continuity tracks** paying thousands specifically for extending an existing open-source project at a later event. Build Phase 1 clean and open now, and the DNS extension is a pre-qualified entry for the next hackathon.

---

## Roger

that is the project! I need one cryptic paragraph about the problem we're solving for the application.

---

## Claude

**The one I'd submit:**

We built machines that remember forever and hung them on hooks that have to be paid for every year. Ethereum will hold your token until the sun burns out; the name it answers to dies after 28 days of silence. Everything we call permanent is rented — the name, the record, the link an immutable contract can never be taught to forget — and the rent falls due on a calendar nobody is watching, charged to a card somebody stopped checking. Nothing breaks loudly. There is no revert, no failed transaction, no alert. The name simply stops resolving, and the thing behind it remains perfectly intact, perfectly addressed, and permanently unreachable. This is not a storage problem. Permanence has an invoice, and nobody ever set up the standing order.

**Colder, shorter:**

Immutability is a promise the chain keeps and the calendar breaks. A name expires in silence — no revert, no alert, no failed transaction — and everything pointing at it goes quietly unreachable while remaining perfectly intact. We treat permanence as a property. It is a subscription, and someone has to remember to pay it. Liveness makes forever fund itself.

**More lyrical:**

There is a specific kind of disappearance that leaves everything in place. The file is fine. The contract is fine. The chain has forgotten nothing. Only the name has gone — lapsed, unpaid, reclaimed by a registry that was never told this mattered — and with it the single thread by which anyone could find their way back. We have spent a decade making things that cannot be destroyed, and hung every one of them from a thread that has to be renewed by hand, by someone who has to still be alive, still care, and still remember the date.

---

## Roger

explain me how ARC will be used for escrow, yield and renewals. are we responsible for keeping deposited tokens?

---

## Claude

Good question, and the honest answer has a sharp edge in it.

Facts confirmed from Arc's docs: **Arc testnet already has USDC, EURC, USYC, CCTP v2, Gateway and StableFX deployed.** USDC is the *native* balance on Arc. And **USYC is live on Arc testnet** at `0xe918…b86C` — that's your yield primitive, on the sponsor's own chain.

Also: **Arc mainnet is not live yet.** That rules out Arc's Track 3 ("Launch on Mainnet").

### Escrow

`Endowment.sol` on Arc, with **per-name earmarks — not a pooled fund.** `alice.eth`'s deposit can never pay for `bob.eth`'s renewal.

Deposit paths: USDC on Arc → straight deposit. USDC elsewhere → CCTP v2 or Gateway. EURC → StableFX. Arbitrary ERC-20 → swap at the edge, then CCTP in.

### Yield

Vault sweeps idle USDC into **USYC** (T-bills and reverse repos, accumulating not rebasing). Three caveats for a limitations slide: USYC is **permissioned** (non-U.S. persons, $100k minimum, 10% performance fee); yield is an assumption not a law; testnet yield is theatre.

**Scoping move:** `IYieldAdapter` with `NullAdapter` (pure drawdown, always works) and `USYCAdapter`.

### Renewals — the one real architectural problem

The money is USDC on Arc. **The renewal happens on Sepolia and costs ETH.**

Don't put the bridge in the critical path. **A prefunded `Renewer` contract on Sepolia** holds three months of renewals as ETH. Anyone calls `renew(name)`; it pays the registrar directly and tips the caller. Separately and asynchronously, the Arc vault tops the buffer back up via CCTP.

*A name's survival must never depend on a bridge being up on a particular Tuesday.*

### Are you responsible for the deposited tokens?

**Yes.** The name stays with its owner — but **the deposit does not.** You are writing custody software.

- **Exactly two exits, hard-coded.** To the ENS registrar, or back to the depositor.
- **Withdrawal always available**, subject to a 30-day notice period. Delayed, never blocked.
- **No admin key that can move funds.** Pause stops new deposits; never withdrawals or renewals.
- **Cap the keeper tip**, paid from the name's own earmark.
- **Cap deposits** for the hackathon and label it unaudited testnet software.

> **We custody money. We never custody the name.** The worst thing that can happen to a user is losing their deposit. It is structurally impossible for them to lose their identity.

---

## Roger

I just noticed ARC is an L1, which is completely unnecessary for this project, and makes it look like a prize grab. I need better sponsors for yield and escrow, which ones can help?

---

## Claude

You're right, and the test you just applied is the right one: **would you use it if there were no prize?** Arc fails it.

### The fact that decides your sponsor choice

ENS renewal is **priced in USD via an oracle but paid in ETH**, on the same chain as the name. Two genuine requirements: the endowment must be **USD-denominated**, and every renewal needs a **just-in-time USDC→ETH swap**.

### Take: ENS + The Graph + Uniswap Foundation

**The asset, the eye, the engine.** All three on Ethereum.

**Uniswap earns it two ways.** The renewal swap is a real dependency. And the second: build an opt-in **v4 Endowment Hook** — any pool can route a basis point of its swap fees into the ENS endowment for a name of its choosing. A DAO's own token pool pays, permanently and automatically, to keep the DAO's name alive.

**One honesty note on yield:** an LP position is the wrong home for money that must be *safe* for a century. `IYieldAdapter` with `NullAdapter`, a Uniswap adapter, and a money-market adapter as the documented mainnet path.

### Why not 1inch

Their track asks for "an Aqua App," and a vault that swaps five dollars once a year is a thin one — you'd be repeating the Arc mistake at smaller scale.

### Chainlink is the safe swap-in

$3k, Automation is the textbook answer to "do this once a year, forever." Not my pick: your permissionless-renewal-plus-tip design already removes the need for a keeper network.

### Watch list

Ledger, Privy and Bazantic haven't published tracks. **Privy is the one to watch** — "endow someone's name as a gift, by email, without them having a wallet."

---

## Roger

but ENSv2 accepts erc20, I think we dont need to swap

---

## Claude

I couldn't verify it, and I'd rather say so than guess — but this is the single most important assumption in the whole architecture.

**What I could confirm:** ENS v1's `renew()` is `payable` — ETH only. ENSv2 replaces `StablePriceOracle` with **`StandardRentPriceOracle`**. The rename is suggestive, but the payment-token question isn't answered anywhere in the v2 docs I could reach.

**How to settle it:** read the `register`/`renew` signatures in the ENSv2 contracts. If they're `payable` with no token parameter, it's ETH. If there's an `IERC20 paymentToken` argument, you're right.

### If you're right, the project gets meaningfully better

One asset end to end. No FX risk. No ETH working balance. No oracle dependency of your own. And a pitch line that flatters ENS for the right reason.

### It also changes my sponsor answer — and you've been asking the wrong question

You've been shopping for a sponsor to own yield and escrow. **Don't.** The vault *is* the project. Outsourcing it to a sponsor is the same instinct that put Arc in the stack — and there's no good on-Ethereum yield sponsor in this lineup anyway.

**If ENSv2 takes ERC-20:** third slot should be UX or automation — Privy, Chainlink, or Uniswap *only* for the Endowment Hook.

**Lock ENS and The Graph now** and start building the vault — it's identical under both branches.

---

## Roger

here: https://docs.ens.domains/ensv2/eth-registrar

---

## Claude

You're right, and confirmed. `renew(label, duration, paymentToken, referrer)` — ERC-20 via `safeTransferFrom`, callable by any account. The swap is dead. But there are two details in that page worth more than the swap you just deleted.

### What this kills

No swap, no ETH balance, no FX mismatch, no oracle of your own, no slippage or MEV on an $8 transaction. And **`renew` being callable by any account is now confirmed in the spec**, not inferred.

### What this unlocks — the two finds

**1. There's a `referrer` parameter.** Spirith passes itself as referrer on every renewal it ever executes. If ENS pays referral rewards, **the protocol has a native revenue model** — funding keeper tips and the dashboard without a token, a fee switch, or a rent-seeking layer.

**2. Multi-year discounts change the whole strategy.** 12.5% off at 2 years, ~31% at 3–5, **~44% at 6**. The naive design — renew one year at a time — is the *worst* option. There's a genuine optimisation: capital spent on a 6-year renewal stops earning yield, but earns 44% off.

**Which makes The Graph's agent load-bearing for real.**

### The math got better

5+ characters is **$8/year**, 4 chars $160, 3 chars $640. Renewed in 6-year blocks at ~44% off: roughly **$4.50/year effective** — a **~$100–120 endowment, once, forever.** A 3-character name needs roughly **$9,000**. The short names everyone speculates on are the ones most likely to die.

### Sponsors — final answer

**ENS + The Graph locked.** **Leave the third slot empty for now** — the rules say *up to* three partner prizes, not three.

### Three things to verify on day one

1. `isPaymentToken(USDC)` on the ENSv2 Sepolia deployment.
2. Does the multi-year discount apply to `renew`, or only `register`?
3. Does `referrer` earn anything?

---

## Roger

for yield: https://aave.com/docs/vaults/stable-vaults

---

## Claude

Good find, and one feature in there matters more than the yield itself.

### Why Stable Vaults are interesting

**A fixed rate is what makes "funded until 2149" an honest claim instead of a guess.** Every other yield source gives you a variable rate, which means your headline number is a forecast dressed up as a date.

### But look at where it lives

**Accounting chain is Arbitrum. Earning chain is Ethereum mainnet.** That's the same objection you just used to kill Arc.

Also: **withdrawals are two-step**; **principal is always redeemable but the interest portion gates against system surplus**; and there are **Integrator and Manager roles** — a "forever" vault built on this inherits somebody else's governance.

None of that is disqualifying. It means the buffer isn't optional: **keep N years of renewals liquid and let only the excess earn.**

### What to actually build

1. **Write to ERC-4626, not to Aave.**
2. **`MockAdapter` for the live demo.**
3. **`AaveAdapter` proven on a mainnet fork.**

### My recommendation on the venue

For v1, **same-chain beats fixed-rate.** Revisit Stable Vaults when their accounting reaches Ethereum, or when Namechain forces multi-chain anyway.

**One product consequence:** with a variable rate, quote a *range*, not a date — "funded through 2140–2165 at current rates."

Sponsors don't change. Aave isn't one, and that's the point — the vault is your intellectual property, and the yield venue is a swappable dependency behind an interface.

---

## Roger

write a detailed handover MD document for claude code, including all moving parts, and future phases for domain names, DNS, and file permanence, with all options we discussed. due to domain and ENS name availability, we're calling the project **Spirith**

---

## Claude

*[Delivered `SPIRITH_HANDOVER.md` — full architecture, contracts, subgraph, agent, sponsor rationale, 8-day plan, demo script, Phases 2 and 3, and a "rejected and why" table.]*

**One thing you need to see immediately:** I checked the actual date. It's **Saturday, September 5**, not August 31. The deadline is Sunday the 13th at noon EDT — that's **8 days, not 13**. I rewrote the plan around that and added a cut list ordered by what to drop first. The Uniswap Endowment Hook is the first thing to go if you're behind; the permissionless `renew()`, the per-name earmark, the resolver record, the dashboard and the video are the things that must survive.

The §3 open questions genuinely gate the build. The biggest is whether the multi-year discount applies to `renew()` or only `register()` — if renewals don't get it, both the cadence optimiser and the ~$110 headline change.

And the third sponsor slot is deliberately empty. Two well-integrated sponsors beat three with one bolted on.

---

## Roger

write the on-liner pitch. Spirith is...

---

## Claude

**Spirith is an endowment for your ENS name — deposit once, and it renews itself forever.**

**For the submission form (adds the mechanism):**
Spirith is a non-custodial endowment for ENS names. Deposit once, the yield pays the renewal, and anyone can trigger it — so your name outlives your calendar, your credit card, and you.

**For a judge, in one breath:**
Spirith is a standing order for permanence. Roughly $110, once, and a `.eth` name never expires again.

**For the landing page:**
Your name expires in 28 days of silence. Spirith makes sure someone is always paying.

---

## Appendix — key sources referenced

- ENSv2 ETH Registrar — https://docs.ens.domains/ensv2/eth-registrar
- ENSv2 overview — https://docs.ens.domains/ensv2/overview/
- ENS DNS import (DNSSEC) — https://docs.ens.domains/learn/dns/
- self-repaying-ens (prior art, 2022) — https://github.com/The-Wary-One/self-repaying-ens
- Aave Stable Vaults — https://aave.com/docs/vaults/stable-vaults
- Filecoin Onchain Cloud — https://filecoin.io/blog/posts/introducing-filecoin-onchain-cloud
- IPFS DNSLink — https://docs.ipfs.tech/concepts/dnslink/
- Swarm postage stamps — https://docs.ethswarm.org/docs/concepts/incentives/postage-stamps/
- Arweave endowment — https://www.arweave.com/blog/endowment-with-arweave
- Arc contract addresses — https://docs.arc.io/arc/references/contract-addresses
- ETHOnline 2026 prizes — https://ethglobal.com/events/ethonline2026/prizes
- ETHOnline 2026 rules & judging — https://ethglobal.com/events/ethonline2026/info/details
