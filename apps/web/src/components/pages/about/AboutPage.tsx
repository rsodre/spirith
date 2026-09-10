import { ExternalLink } from '@/components/ExternalLink';
import { REPO_URL } from '@/lib/links';

// What Spirith is, in the order a careful reader asks: what it holds, how a renewal happens,
// what it costs, what it cannot promise, and who did it first. Prose, ruled by headings.
export function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <article className="max-w-3xl">
        <h1 className="text-5xl md:text-6xl">Deposit once. Your ENS name renews itself forever.</h1>
        <p className="mt-5 font-title text-xl leading-relaxed text-muted">
          Spirith is a non-custodial endowment for ENS names, built for ETHGlobal ETHOnline 2026 on
          the ENSv2 Sepolia beta.
        </p>

        <h2>The vault holds the deposit. It never touches the name.</h2>
        <p>
          A deposit is earmarked for exactly one name. It can leave the vault in exactly two
          directions: to the ENS registrar as that name's renewal payment, or back to the patron who
          put it in, after thirty days of notice. No admin key can move funds. The owner of the
          contract can pause new deposits and nothing else; a pause never blocks a withdrawal or a
          renewal. The worst thing that can happen to a patron is losing the deposit. It is
          structurally impossible to lose the name, because the vault never touches it.
        </p>

        <h2>Why now</h2>
        <p>
          ENSv2 cut the grace period from 90 days to 28 and moved payment to ERC-20 tokens. The
          first change cuts the margin for human error by two thirds. The second makes a renewal
          something a contract can pay, and ENSv2's <code>renew()</code> is callable by any account.
          Those two facts are the whole product.
        </p>

        <h2>How a renewal happens</h2>
        <ol>
          <li>
            Anyone deposits USDC for a name. Two years of renewals stay liquid in the vault; the
            rest goes to a yield venue through an ERC-4626 adapter.
          </li>
          <li>
            Once the name is inside its 30-day lead window, or already in grace, anyone may call{' '}
            <code>renew()</code>. The vault pays the registrar directly for the longest of six,
            three, two or one years the earmark affords without breaking its reserve, and tips the
            caller one percent, capped at one USDC.
          </li>
          <li>
            The vault then writes <code>spirith.funded-until</code> and <code>spirith.patrons</code>{' '}
            on the name's resolver, so any wallet or marketplace can see the name is endowed without
            asking us. That needs one authorisation from the name's owner; renewals never depend on
            it.
          </li>
        </ol>

        <h2>What it costs</h2>
        <p>
          ENSv2 gives multi-year renewals a discount, up to 43.75% off at six years, so renewing in
          six-year blocks is far cheaper per year than renewing yearly. Capital spent on a block
          stops earning, though, so the right cadence is a real optimisation, and the agent behind
          this dashboard does it. At 4–5% yield, about $120 to $145 deposited once keeps a normal
          five-letter name alive indefinitely, with the two-year liquid reserve included. Four- and
          three-character names cost twenty and eighty times that.
        </p>

        <h2>What we do not promise</h2>
        <p>
          Yield is a forecast, not a law; a perpetual endowment priced on today's rate is an
          estimate, which is why every funded-until figure here is a range. Yield on testnet is
          simulated, because no lending market on Sepolia accepts the ENS test tokens; the real
          adapter is proven on an Ethereum mainnet fork against Aave's USDC vault. On mainnet a
          single yield venue would be a single point of failure, so the vault should offer several
          approved providers per name and let patrons choose and switch between them; today it has
          one. Nothing is audited, and deposits are capped at 200 test USDC.
        </p>

        <h2>Code</h2>
        <p>
          Contracts, subgraph, agent and this dashboard are open source at{' '}
          <ExternalLink href={REPO_URL}>{REPO_URL.replace('https://', '')}</ExternalLink>. The vault
          on Sepolia is verified on Etherscan; the addresses are on the bench page and in the
          repository.
        </p>
      </article>
    </main>
  );
}
