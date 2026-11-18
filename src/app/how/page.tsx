import Link from "next/link";
import { cents, quote } from "@/lib/pricing";

export default function HowPage() {
  const q = quote(6800, 2000, 0.09);
  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6">
      <div className="grid md:grid-cols-[1fr_1.35fr]">
        <div className="py-14 md:sticky md:top-[57px] md:self-start md:pr-12">
          <div className="label">Mechanics</div>
          <h1 className="serif mt-4 text-[52px] leading-[0.95] md:text-[64px]">
            A store can&apos;t take a bet on every hoodie.
            <br />
            <em className="text-red">A market can.</em>
          </h1>
          <div className="mt-10 border border-ink p-5">
            <div className="label">The one line</div>
            <div className="mono mt-3 text-[17px]">W = (B − L·q) / (1 − q)</div>
            <dl className="mono mt-4 grid grid-cols-[28px_1fr] gap-y-1 text-[11.5px] text-ink-3">
              <dt>B</dt>
              <dd>list price</dd>
              <dt>L</dt>
              <dd>net price if the clause is satisfied</dd>
              <dt>q</dt>
              <dd>market price of it being satisfied</dd>
              <dt>W</dt>
              <dd>price paid today, plus a 1.5% fee</dd>
            </dl>
          </div>
        </div>

        <div className="border-t border-line py-14 md:border-t-0 md:border-l md:pl-12">
          <div className="body-serif space-y-6 text-ink-2">
            <p>
              Fans would love a price that depends on the game. Stores have never offered one, because if the team loses the store eats the discount on every item it sold that week. No insurer writes &ldquo;Texas lose&rdquo; cover by the hoodie.
            </p>
            <p>
              A prediction market is exactly that insurer. On Gemini there is a live market on every game: a contract that pays <span className="figure">$1.00</span> if Texas lose and nothing if they win, trading at the crowd&apos;s best guess of the odds. Clause buys the right amount of that contract the instant you execute.
            </p>
          </div>

          <div className="mt-14">
            <div className="label">Worked example · list {cents(6800)} · &ldquo;Texas lose&rdquo; at {q.hedgePrice.toFixed(2)}</div>
            <table className="ledger mt-4">
              <tbody>
                <Row k="Buyer's net price if satisfied" v={cents(q.loseCents)} />
                <Row k="Price today, solved from the odds" v={cents(q.winCents)} />
                <Row k="Returned if satisfied" v={cents(q.rebateCents)} />
                <Row k={`Contracts the store buys at ${q.hedgePrice.toFixed(2)}`} v={String(q.contractsQty)} />
                <Row k="Cost of the hedge" v={cents(q.hedgeCostCents)} />
              </tbody>
            </table>
            <table className="ledger mt-8">
              <thead>
                <tr>
                  <th>Outcome</th>
                  <th className="r">Store keeps</th>
                  <th className="r">Hedge pays</th>
                  <th className="r">Hedge cost</th>
                  <th className="r">Store nets</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Texas win</td>
                  <td className="num r">{cents(q.winCents)}</td>
                  <td className="num r">–</td>
                  <td className="num r">−{cents(q.hedgeCostCents)}</td>
                  <td className="num r">{cents(q.merchantRevenueIfNoRebateCents)}</td>
                </tr>
                <tr>
                  <td>Texas lose</td>
                  <td className="num r">{cents(q.loseCents)}</td>
                  <td className="num r">{cents(Math.round(q.contractsQty * 100))}</td>
                  <td className="num r">−{cents(q.hedgeCostCents)}</td>
                  <td className="num r">{cents(q.merchantRevenueIfRebateCents)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-[12px] text-ink-3">The two figures in the last column differ by rounding only. The store is indifferent to the result, which is the whole point.</p>
          </div>

          <div className="body-serif mt-14 space-y-6 text-ink-2">
            <h2 className="serif text-[34px] text-ink">Where the money sits</h2>
            <p>
              Your payment goes into an escrow account on Solana as USDC, a dollar stablecoin. You never see a wallet: the store holds one for you the way it would hold a gift-card balance. When Gemini resolves the market, the escrow pays the store its share and returns yours, in two transactions nobody has to approve, file, or chase.
            </p>
            <p>That is what makes a clause a product and not a promise. There is no refunds desk. The result settles the market, and the market settles you.</p>
          </div>

          <div className="mt-12 flex gap-3">
            <Link href="/" className="btn">
              Draft a clause
            </Link>
            <Link href="/merchant" className="btn btn-ghost">
              The store&apos;s ledger
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <td>{k}</td>
      <td className="num r">{v}</td>
    </tr>
  );
}
