'use client';

import Link from 'next/link';
import { useNamespace } from '@/hooks/queries/use-namespace';
import { useDyingCount } from '@/hooks/use-dying-count';
import { APP_ENV } from '@/lib/chain';

// The front door: one live sentence, the problem statement verbatim (HANDOVER §1), and the
// way in to each register. Nothing here is a control; every number is a link.
export function HomePage() {
  const dying = useDyingCount();
  const namespace = useNamespace();
  const ns = namespace.data?.namespace ?? null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <section className="max-w-3xl">
        <h1 className="text-5xl md:text-7xl">
          {dying.isLoading ? (
            <span className="motion-safe:animate-pulse-soft text-muted">Counting the names…</span>
          ) : dying.error ? (
            <span>The index is unreachable.</span>
          ) : (
            <Link href="/expiring" className="hover:no-underline">
              <span className="text-oxide">{dying.count}</span>{' '}
              {dying.count === 1 ? 'name dies' : 'names die'} this month.
            </Link>
          )}
        </h1>
        <p className="mt-5 font-title text-xl leading-relaxed text-muted">
          {dying.error || dying.isLoading
            ? `Every .eth name on ${APP_ENV.title}, read from the chain.`
            : `${dying.grace} of them have already expired and are living out their 28 days of grace. Deposit once, and a name never joins them.`}
        </p>
      </section>

      <blockquote className="mt-16 max-w-3xl border-l-2 border-line-strong pl-6 font-title text-2xl leading-relaxed">
        We built machines that <strong>remember forever</strong> and hung them on hooks that have to
        be <strong>paid for every year</strong>. Ethereum will hold your token until the sun burns
        out; the name it answers to dies after <strong>28 days of silence</strong>. Everything we
        call permanent is <strong>rented</strong> — the name, the record, the link an immutable
        contract can never be taught to forget — and the rent falls due on a calendar{' '}
        <strong>nobody is watching</strong>, charged to a card somebody stopped checking.{' '}
        <strong>Nothing breaks loudly.</strong> There is no revert, no failed transaction, no alert.
        The name simply <strong>stops resolving</strong>, and the thing behind it remains perfectly
        intact, perfectly addressed, and <strong>permanently unreachable</strong>. This is not a
        storage problem. <strong>Permanence has an invoice</strong>, and nobody ever set up the{' '}
        <strong>standing order</strong>.
      </blockquote>

      <section className="mt-16 max-w-3xl">
        <p className="font-title text-2xl leading-relaxed">
          Spirith is a non-custodial endowment for ENS names. Deposit USDC <strong>once</strong> for
          a name; it earns yield; when the name comes due, <strong>anyone</strong> can pay the
          renewal from that deposit and take a small tip. The vault holds the deposit and nothing
          else. <strong>It never touches the name.</strong>
        </p>
      </section>

      <nav
        aria-label="Registers"
        className="mt-16 grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Door
          href="/expiring"
          title="Expiring"
          text="Every name inside its last 28 days, worst first, and what it would cost to keep each alive."
          figure={dying.count !== undefined ? `${dying.count} names` : undefined}
        />
        <Door
          href="/endowed"
          title="Endowed"
          text="The names with a standing order: how much each holds and how far that reaches."
          figure={ns ? `${ns.endowedNames} ${ns.endowedNames === 1 ? 'name' : 'names'}` : undefined}
        />
        <Door
          href="/graveyard"
          title="Graveyard"
          text="Names past their grace period. Still addressed, no longer reachable."
        />
        <Door
          href="/patron"
          title="Patron"
          text="Your endowments and your names; find a name to endow, or register a new one."
        />
        <Door
          href="/about"
          title="About"
          text="How the vault works, what it can and cannot do, and what it costs to make a name immortal."
        />
        <Door
          href="/roadmap"
          title="Roadmap"
          text="The same standing order for the files an NFT points at, and for the .com old contracts still hard-code."
        />
        <Door
          href="/developers"
          title="Developers"
          text="The source, the contracts on Sepolia, the subgraph, the MCP server and the keeper."
        />
      </nav>
    </main>
  );
}

function Door({
  href,
  title,
  text,
  figure,
}: {
  href: string;
  title: string;
  text: string;
  figure?: string;
}) {
  return (
    <Link href={href} className="group block border-line border-t pt-4 hover:no-underline">
      <span className="flex items-baseline justify-between gap-4">
        <span className="font-title text-2xl group-hover:underline">{title}</span>
        {figure ? <span className="text-sm text-muted">{figure}</span> : null}
      </span>
      <span className="mt-2 block text-sm text-muted">{text}</span>
    </Link>
  );
}
