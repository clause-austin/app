import Link from "next/link";
import { cents, quote } from "@/lib/pricing";

export default function HowPage() {
  // Worked example at a 9% chance of the clause triggering (Texas as a heavy favourite).
  const q = quote(6800, 2000, 0.09);
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <div className="text-[11px] uppercase tracking-[0.18em] text-ink-3">How a clause works</div>
      <h1 className="font-display mt-2 text-5xl font-semibold leading-tight">
        A store can&apos;t take a bet on every hoodie.
        <br />
        <span className="text-orange">A market can.</span>
      </h1>

      <div className="prose-sm mt-10 space-y-6 text-[15px] leading-relaxed text-ink-2">
        <p>
          Fans would love a price that depends on the game. Stores have never offered one, because if the team loses, the store eats the discount on every item it sold that week. No insurer sells &ldquo;Texas loses&rdquo; coverage per hoodie.
        </p>
        <p>
          Prediction markets are exactly that insurer. On Gemini there is a live market on every game: a contract that pays <strong>$1 if Texas lose</strong> and nothing if they win, trading at the crowd&apos;s best guess of the odds. Clause buys the right amount of that contract the instant you check out.
        </p>
      </div>

      <section className="mt-12 rounded-3xl border border-line bg-paper p-6 md:p-8">
        <h2 className="font-display text-2xl font-semibold">Worked example</h2>
        <p className="mt-1 text-sm text-ink-3">Gameday Hoodie, sticker {cents(6800)}. Texas are heavy favourites: the market prices &ldquo;Texas lose&rdquo; at {q.hedgePrice.toFixed(2)}.</p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Step n="1" t="You name your bad-day price">
            You decide you&apos;d like to have paid <b>{cents(q.loseCents)}</b> if Texas lose. Clause solves for today&apos;s price: <b>{cents(q.winCents)}</b>.
          </Step>
          <Step n="2" t="The store hedges">
            Difference is {cents(q.rebateCents)}. The store buys <b>{q.contractsQty}</b> &ldquo;Texas lose&rdquo; contracts at {q.hedgePrice.toFixed(2)}, costing <b>{cents(q.hedgeCostCents)}</b>.
          </Step>
          <Step n="3" t="Either way, the same">
            Texas win: store keeps {cents(q.winCents)}, minus the {cents(q.hedgeCostCents)} hedge = <b>{cents(q.merchantRevenueIfNoRebateCents)}</b>. Texas lose: store keeps {cents(q.loseCents)}, hedge pays {cents(Math.round(q.contractsQty * 100))}, minus cost = <b>{cents(q.merchantRevenueIfRebateCents)}</b>.
          </Step>
        </div>
        <div className="mt-6 rounded-2xl bg-ink p-5 font-mono text-sm text-cream">
          <div className="text-[11px] uppercase tracking-widest text-cream/50">The one line of math</div>
          <div className="mt-2">W = (B − L·q) / (1 − q)</div>
          <div className="mt-1 text-xs text-cream/60">B sticker price · L your bad-day price · q market price of the clause triggering · W what you pay today. Plus a 1.5% clause fee to cover the spread.</div>
        </div>
      </section>

      <section className="mt-12 space-y-6 text-[15px] leading-relaxed text-ink-2">
        <h2 className="font-display text-2xl font-semibold text-ink">Where the money actually sits</h2>
        <p>
          Your payment goes into an escrow account on Solana as USDC, a dollar stablecoin. You never see a wallet: the store holds a wallet for you the way it would hold a gift-card balance. When Gemini settles the market, the escrow pays the store its share and sends your rebate back, in two transactions nobody has to approve, file, or chase.
        </p>
        <p>
          That is the part that makes a clause a product and not a promise. There is no refunds desk. The result settles the market, and the market settles you.
        </p>
      </section>

      <div className="mt-12 flex gap-3">
        <Link href="/" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream hover:bg-orange">
          Try one
        </Link>
        <Link href="/merchant" className="rounded-full border border-ink px-6 py-3 text-sm font-semibold hover:bg-cream-2">
          See the store&apos;s side
        </Link>
      </div>
    </div>
  );
}

function Step({ n, t, children }: { n: string; t: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-cream p-4">
      <div className="scoreboard text-xs text-orange">{n}</div>
      <div className="font-display mt-1 text-lg font-semibold leading-tight">{t}</div>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}
