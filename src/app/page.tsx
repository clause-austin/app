import Link from "next/link";
import Image from "next/image";
import { boot } from "@/lib/boot";
import { listProducts, sellerNames } from "@/lib/orders";
import { featuredEvents, marketDataStatus, type GeminiEvent } from "@/lib/gemini/public";
import { cents, quote } from "@/lib/pricing";
import { defaultContract, ask, kickoff, shortWhen, openContracts } from "@/components/market";
import { OddsTicker } from "@/components/OddsTicker";
import { Blocks } from "@/components/Blocks";

export const dynamic = "force-dynamic";

export default async function Home() {
  boot();
  const products = listProducts();
  const sellers = sellerNames(products.map((p) => p.seller_id).filter(Boolean) as string[]);
  let events: GeminiEvent[] = [];
  try {
    events = await featuredEvents();
  } catch {
    events = [];
  }
  const md = marketDataStatus();
  const hero = events[0];
  const team = hero ? defaultContract(hero) : undefined;
  const other = hero && team ? openContracts(hero).find((c) => c.id !== team.id) : undefined;
  const loseAsk = team ? ask(team, "no") : NaN;
  const live = Number.isFinite(loseAsk);

  return (
    <div>
      {/* Hero */}
      <div className="grid-lines grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
        <div className="cell flex flex-col justify-between">
          <div className="tag border-b border-fg px-4 py-2">Conditional pricing · hedged on prediction markets · settled in USDC</div>
          <div className="px-4 pt-10 pb-8 md:pt-16">
            <h1 className="h-xl">
              Pay less
              <br />
              if they
              <br />
              <span className="text-acc">lose.</span>
            </h1>
          </div>
          <div className="grid-lines grid-cols-1 border-t border-fg md:grid-cols-[1fr_auto]">
            <p className="cell max-w-[60ch] px-4 py-4 text-[13px] leading-relaxed">
              Any price can carry a condition. Pick the game, pick the team, pick what you&apos;d rather have paid if it goes wrong. The store hedges the difference on Gemini the moment you pay, and the escrow returns it the moment the market settles.
            </p>
            <Link href={`/p/${products[0]?.slug ?? ""}`} className="cell btn md:w-[240px]">
              <span>Build one</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        <div className="cell flex flex-col">
          <div className="flex items-center justify-between border-b border-fg px-4 py-2">
            <span className="tag">Market · {md.source === "live" ? "live" : `last known · ${new Date(md.asOf).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}</span>
            {hero && <span className="tag">{shortWhen(kickoff(hero, team))}</span>}
          </div>
          {hero && team ? (
            <>
              <div className="h-md px-4 pt-5 pb-4">{hero.title}</div>
              <div className="grid-lines grid-cols-1 border-t border-fg">
                {[team, other].filter(Boolean).map((c) => {
                  const p = ask(c!, "yes");
                  return (
                    <div key={c!.id} className="cell px-4 py-4">
                      <div className="flex items-end justify-between">
                        <span className="text-[12px] font-bold uppercase tracking-[0.06em]">{c!.label} win</span>
                        <span className="num-lg">{p.toFixed(2)}</span>
                      </div>
                      <Blocks fill={p} acc={c!.id === team.id} className="mt-3" />
                    </div>
                  );
                })}
              </div>
              {live && products[0] && (
                <div className="mt-auto border-t border-fg px-4 py-4">
                  <div className="tag">Example</div>
                  {(() => {
                    const q = quote(products[0].price_cents, Math.round(products[0].price_cents * 0.3), loseAsk);
                    return (
                      <p className="mt-2 text-[13px] leading-relaxed">
                        {products[0].name}: <span className="strike">{cents(products[0].price_cents)}</span> <b>{cents(q.winCents)}</b> today. If {team.label} lose, <b className="text-acc">{cents(q.rebateCents)}</b> comes back. Net{" "}
                        <b>{cents(q.loseCents)}</b>. The store earns {cents(q.merchantRevenueIfNoRebateCents)} either way.
                      </p>
                    );
                  })()}
                </div>
              )}
            </>
          ) : (
            <div className="px-4 py-6 text-mute">No open markets right now.</div>
          )}
        </div>
      </div>

      {events.length > 0 && <OddsTicker events={events.slice(0, 14)} source={md.source} />}

      {/* Goods */}
      <div className="grid-lines grid-cols-[1fr_auto] border-b border-fg">
        <div className="cell flex items-baseline gap-4 px-4 py-3">
          <span className="h-md">Goods</span>
          <span className="tag">{String(products.length).padStart(2, "0")} items</span>
        </div>
        <div className="cell tag flex items-center px-4">{team ? `Clause column: ${team.label} lose · net at 30% of list` : "List prices"}</div>
      </div>
      <div className="grid-lines grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p, i) => {
          const q = live ? quote(p.price_cents, Math.round(p.price_cents * 0.3), loseAsk) : null;
          return (
            <Link key={p.id} href={`/p/${p.slug}`} className="cell group flex flex-col">
              <div className="relative aspect-[4/5] overflow-hidden border-b border-fg bg-faint">
                <Image src={p.image} alt={p.name} fill unoptimized={!p.image.startsWith("/products/")} sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
                <span className="absolute left-0 top-0 bg-fg px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-bg">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="inv flex flex-1 flex-col px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-[16px] font-extrabold uppercase leading-none tracking-[-0.02em]">{p.name}</span>
                  <span className="num-md">{cents(p.price_cents)}</span>
                </div>
                <div className="tag mt-1">{p.seller_id ? `Listed by ${sellers.get(p.seller_id) ?? "a seller"} · ${p.tagline}` : p.tagline}</div>
                {q && (
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div>
                      <div className="tag">Today</div>
                      <div className="mt-1 text-[15px] font-bold">{cents(q.winCents)}</div>
                    </div>
                    <div>
                      <div className="tag">Back if lose</div>
                      <div className="mt-1 text-[15px] font-bold text-acc group-hover:text-bg">{cents(q.rebateCents)}</div>
                    </div>
                    <div>
                      <div className="tag">Net</div>
                      <div className="mt-1 text-[15px] font-bold">{cents(q.loseCents)}</div>
                    </div>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
        {Array.from({ length: (3 - (products.length % 3)) % 3 }, (_, i) => (
          <div key={`pad3-${i}`} className="cell hidden lg:block" />
        ))}
        {Array.from({ length: products.length % 2 }, (_, i) => (
          <div key={`pad2-${i}`} className="cell hidden sm:block lg:hidden" />
        ))}
        <Link href="/sell" className="cell inv col-span-full grid grid-cols-[auto_1fr_auto] items-center gap-6 px-4 py-6">
          <div className="tag">{String(products.length + 1).padStart(2, "0")}</div>
          <div>
            <div className="h-md">Sell something</div>
            <p className="mt-1 max-w-[60ch] text-[12px] text-mute">List anything. Buyers attach a clause, Clause hedges it, you get list price either way.</p>
          </div>
          <div className="text-[24px]">→</div>
        </Link>
      </div>

      {/* Mechanics */}
      <div className="grid-lines grid-cols-1 border-t border-fg md:grid-cols-3">
        {[
          ["01", "You set the terms", "Game, team, and the price you'd be content with if it goes badly. Today's price is solved from the live odds."],
          ["02", "The store hedges", "On payment the store buys the matching contract on Gemini. Its revenue is identical either way, so it can say yes to anyone."],
          ["03", "Money moves itself", "Your payment sits in USDC escrow on Solana. The market's resolution releases it: yours back to you, the store's to the store."],
        ].map(([n, t, d]) => (
          <div key={n} className="cell px-4 py-6">
            <div className="tag">{n}</div>
            <div className="h-md mt-3">{t}</div>
            <p className="mt-3 max-w-[40ch] text-[12.5px] leading-relaxed text-mute">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
