import Link from "next/link";
import Image from "next/image";
import { boot } from "@/lib/boot";
import { listProducts } from "@/lib/orders";
import { featuredEvents, type GeminiEvent } from "@/lib/gemini/public";
import { cents, quote } from "@/lib/pricing";
import { defaultContract, ask, kickoff, shortWhen } from "@/components/market";
import { OddsTicker } from "@/components/OddsTicker";

export const dynamic = "force-dynamic";

export default async function Home() {
  boot();
  const products = listProducts();
  let events: GeminiEvent[] = [];
  try {
    events = await featuredEvents();
  } catch {
    events = [];
  }
  const hero = events[0];
  const heroContract = hero ? defaultContract(hero) : undefined;
  const heroLoseAsk = heroContract ? ask(heroContract, "no") : NaN;

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-14 pb-10 md:pt-20">
        <div className="grid items-end gap-10 md:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-ink-2">
              <span className="live-dot inline-block h-2 w-2 rounded-full bg-green" />
              Live odds from Gemini prediction markets
            </div>
            <h1 className="font-display text-[56px] leading-[0.95] font-semibold md:text-[88px]">
              Pay less
              <br />
              if they <span className="text-orange">lose.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
              Every item in this store can carry a <em className="font-display not-italic font-semibold">clause</em>: a price that changes with the game.
              Pick the team, pick what you&apos;d pay if it goes wrong, and the difference comes back to you the moment the final whistle blows.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={`/p/${products[0]?.slug ?? ""}`} className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream hover:bg-orange">
                Build your first clause
              </Link>
              <Link href="/how" className="rounded-full border border-ink px-6 py-3 text-sm font-semibold hover:bg-cream-2">
                How can a store afford this?
              </Link>
            </div>
          </div>

          {hero && heroContract && (
            <div className="perf rounded-2xl border border-line bg-paper p-6 shadow-[0_20px_60px_-30px_rgba(60,30,0,0.45)]">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-ink-3">
                <span>This week&apos;s headline</span>
                <span>{shortWhen(kickoff(hero, heroContract))}</span>
              </div>
              <div className="font-display mt-2 text-3xl font-semibold leading-tight">{hero.title}</div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {hero.contracts
                  .filter((c) => c.marketState !== "closed")
                  .map((c) => (
                    <div key={c.id} className={`rounded-xl border p-3 ${c.id === heroContract.id ? "border-orange bg-orange-soft/50" : "border-line"}`}>
                      <div className="text-xs text-ink-3">{c.label}</div>
                      <div className="scoreboard mt-1 text-3xl font-semibold">{Math.round(ask(c, "yes") * 100)}%</div>
                      <div className="text-[11px] text-ink-3">to win</div>
                    </div>
                  ))}
              </div>
              {Number.isFinite(heroLoseAsk) && products[0] && (
                <div className="mt-5 rounded-xl bg-ink p-4 text-cream">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-cream/60">Example clause</div>
                  <div className="mt-1 text-sm leading-snug">
                    {products[0].name}: pay{" "}
                    <span className="scoreboard font-semibold">{cents(quote(products[0].price_cents, Math.round(products[0].price_cents * 0.3), heroLoseAsk).winCents)}</span> today, or{" "}
                    <span className="scoreboard font-semibold text-orange-2">{cents(Math.round(products[0].price_cents * 0.3))}</span> if {heroContract.label} lose.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {events.length > 0 && <OddsTicker events={events.slice(0, 12)} />}

      {/* Products */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-4xl font-semibold">The shop</h2>
            <p className="mt-1 text-ink-3">Six things worth wearing to a game. Each one takes a clause.</p>
          </div>
          <div className="hidden text-right text-xs text-ink-3 md:block">
            Clause prices shown for <span className="font-medium text-ink">{heroContract?.label ?? "the favourite"}</span> losing
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const q = Number.isFinite(heroLoseAsk) ? quote(p.price_cents, Math.round(p.price_cents * 0.3), heroLoseAsk) : null;
            return (
              <Link key={p.id} href={`/p/${p.slug}`} className="group rounded-2xl border border-line bg-paper p-3 transition hover:-translate-y-0.5 hover:border-ink hover:shadow-lg">
                <div className="relative overflow-hidden rounded-xl">
                  <Image src={p.image} alt={p.name} width={400} height={400} className="w-full transition duration-500 group-hover:scale-[1.03]" />
                  <span className="absolute left-3 top-3 rounded-full bg-ink/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-cream">Takes a clause</span>
                </div>
                <div className="flex items-start justify-between gap-3 px-1 pt-4 pb-1">
                  <div>
                    <div className="font-display text-xl font-semibold">{p.name}</div>
                    <div className="text-sm text-ink-3">{p.tagline}</div>
                  </div>
                  <div className="text-right">
                    <div className="scoreboard text-xl font-semibold">{cents(p.price_cents)}</div>
                    {q && (
                      <div className="text-[11px] text-ink-3">
                        or <span className="font-semibold text-orange">{cents(q.loseCents)}</span> if they lose
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Three steps */}
      <section className="mx-auto max-w-6xl px-4 pb-10">
        <div className="grid gap-4 rounded-3xl border border-line bg-paper p-6 md:grid-cols-3 md:p-10">
          {[
            ["01", "You name your price", "Choose the game, the team, and what you'd be happy paying if it goes badly. The price you pay today adjusts to the odds."],
            ["02", "The store hedges instantly", "The moment you check out, the store buys the matching side on Gemini's prediction market. Whatever happens, it makes the same money."],
            ["03", "Money moves itself", "Your payment waits in escrow on Solana. When the market settles, your rebate lands without anyone lifting a finger. No forms, no refunds desk."],
          ].map(([n, t, d]) => (
            <div key={n}>
              <div className="scoreboard text-sm text-orange">{n}</div>
              <div className="font-display mt-1 text-2xl font-semibold">{t}</div>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
