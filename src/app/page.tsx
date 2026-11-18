import Link from "next/link";
import Image from "next/image";
import { boot } from "@/lib/boot";
import { listProducts } from "@/lib/orders";
import { featuredEvents, marketDataStatus, type GeminiEvent } from "@/lib/gemini/public";
import { cents, quote } from "@/lib/pricing";
import { defaultContract, ask, kickoff, shortWhen, openContracts } from "@/components/market";
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
  const md = marketDataStatus();
  const hero = events[0];
  const team = hero ? defaultContract(hero) : undefined;
  const other = hero && team ? openContracts(hero).find((c) => c.id !== team.id) : undefined;
  const loseAsk = team ? ask(team, "no") : NaN;
  const live = Number.isFinite(loseAsk);
  const specimen = live && products[0] ? quote(products[0].price_cents, Math.round(products[0].price_cents * 0.3), loseAsk) : null;

  return (
    <div>
      {/* Title page */}
      <section className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid md:grid-cols-[1.25fr_1fr]">
          <div className="py-14 md:py-24 md:pr-16">
            <div className="label">Instrument of conditional sale</div>
            <h1 className="serif mt-6 text-[64px] leading-[0.92] md:text-[112px]">
              Pay less
              <br />
              if they <em className="text-red">lose.</em>
            </h1>
            <p className="body-serif mt-10 max-w-[30ch] text-ink-2">
              Any price can carry a condition. Name the game, name the team, name what you&apos;d rather have paid if it goes wrong. The difference comes back the moment the market settles.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link href={`/p/${products[0]?.slug ?? ""}`} className="btn">
                Draft a clause
              </Link>
              <Link href="/how" className="btn btn-ghost">
                How a store affords this
              </Link>
            </div>
          </div>

          <aside className="border-t border-line py-10 md:border-t-0 md:border-l md:py-24 md:pl-12">
            <div className="label">Recital · {md.source === "live" ? "live market" : "last known prices"}</div>
            {hero && (
              <div className="mono mt-1 text-[11px] text-ink-3">
                Kickoff {shortWhen(kickoff(hero, team))}
                {md.source !== "live" && ` · prices as of ${new Date(md.asOf).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
              </div>
            )}
            {hero && team ? (
              <>
                <div className="serif mt-4 text-[34px] leading-[1.05]">{hero.title}</div>
                <div className="mt-6 space-y-3">
                  {[team, other].filter(Boolean).map((c) => {
                    const p = ask(c!, "yes");
                    return (
                      <div key={c!.id}>
                        <div className="flex items-baseline justify-between">
                          <span className="text-[13px]">{c!.label} to win</span>
                          <span className="num text-[13px]">{p.toFixed(2)}</span>
                        </div>
                        <div className="mt-1.5 h-px bg-line">
                          <div className="h-px bg-ink" style={{ width: `${Math.round(p * 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {specimen && products[0] && (
                  <div className="mt-8 border-t border-line pt-5">
                    <div className="label">Specimen clause</div>
                    <p className="serif mt-2 text-[19px] leading-snug">
                      <em>{products[0].name}</em>, listed at <span className="figure redline">{cents(products[0].price_cents)}</span>{" "}
                      <span className="figure">{cents(specimen.winCents)}</span> today. Should {team.label} lose, <span className="figure">{cents(specimen.rebateCents)}</span> is returned, so the net
                      price is <span className="figure">{cents(specimen.loseCents)}</span>.
                    </p>
                    <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">
                      Gemini prices &ldquo;{team.label} lose&rdquo; at {loseAsk.toFixed(2)}. The store buys {specimen.contractsQty} of those contracts at checkout and earns {cents(specimen.merchantRevenueIfNoRebateCents)} whichever way the game goes.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-4 text-ink-3">No open markets right now.</p>
            )}
          </aside>
        </div>
      </section>

      {events.length > 0 && <OddsTicker events={events.slice(0, 14)} />}

      {/* Schedule A: goods */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="label">Schedule A</div>
            <h2 className="serif mt-2 text-[40px] leading-none">Goods</h2>
          </div>
          {team && <div className="label">Clause column assumes {team.label} lose · net price at 30% of list</div>}
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="ledger min-w-[640px]">
            <thead>
              <tr>
                <th className="w-12">No.</th>
                <th>Item</th>
                <th className="r">List</th>
                <th className="r">Pay today</th>
                <th className="r">Returned if they lose</th>
                <th className="r">Net</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => {
                const q = live ? quote(p.price_cents, Math.round(p.price_cents * 0.3), loseAsk) : null;
                return (
                  <tr key={p.id} className="group relative hover:bg-paper-2/70">
                    <td className="mono text-ink-3">{String(i + 1).padStart(2, "0")}</td>
                    <td>
                      <Link href={`/p/${p.slug}`} className="flex items-center gap-4 after:absolute after:inset-0">
                        <Image src={p.image} alt="" width={44} height={44} className="art h-11 w-11 shrink-0" />
                        <span>
                          <span className="serif block text-[20px] leading-none">{p.name}</span>
                          <span className="mt-1 block text-xs text-ink-3">{p.tagline}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="num r">{cents(p.price_cents)}</td>
                    <td className="num r">{q ? cents(q.winCents) : "–"}</td>
                    <td className="num r text-red">{q ? cents(q.rebateCents) : "–"}</td>
                    <td className="num r">{q ? cents(q.loseCents) : "–"}</td>
                    <td className="mono r text-ink-3 transition group-hover:text-red">→</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mechanics */}
      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl md:grid-cols-3">
          {[
            ["§ 1", "You set the terms", "Choose the game, the team, and what you would be content paying if it goes badly. Today's price is solved from the live odds, not set by us."],
            ["§ 2", "The store hedges", "On execution the store buys the matching contract on Gemini's prediction market. Its revenue is identical either way, so it can say yes to anyone."],
            ["§ 3", "Money moves itself", "Your payment waits in a USDC escrow on Solana. The market's resolution releases it: your share back to you, the store's to the store. No refunds desk."],
          ].map(([n, t, d], i) => (
            <div key={n} className={`px-4 py-10 md:px-8 ${i > 0 ? "border-t border-line md:border-t-0 md:border-l" : ""}`}>
              <div className="sect">{n}</div>
              <div className="serif mt-3 text-[28px] leading-tight">{t}</div>
              <p className="mt-3 max-w-[38ch] text-[13.5px] leading-relaxed text-ink-2">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
