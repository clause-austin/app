import Link from "next/link";
import { cents, quote } from "@/lib/pricing";
import { Blocks } from "@/components/Blocks";

export default function HowPage() {
  const q = quote(6800, 2000, 0.09);
  return (
    <div>
      <div className="grid-lines grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
        <div className="cell px-4 pt-10 pb-8">
          <div className="tag">How</div>
          <h1 className="h-lg mt-4">
            A store can&apos;t take a bet on every hoodie.
            <br />
            <span className="text-acc">A market can.</span>
          </h1>
        </div>
        <div className="cell flex flex-col">
          <div className="tag border-b border-fg px-4 py-2">The one line</div>
          <div className="num-lg px-4 py-6">W = (B − L·q) / (1 − q)</div>
          <dl className="grid-lines mt-auto grid-cols-[48px_1fr] border-t border-fg text-[12px]">
            {[
              ["B", "list price"],
              ["L", "what you pay if the clause triggers"],
              ["q", "market price of it triggering"],
              ["W", "what you pay today, plus a 1.5% fee"],
            ].map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="cell px-4 py-2 font-bold">{k}</dt>
                <dd className="cell px-4 py-2 text-mute">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="grid-lines grid-cols-1 border-t border-fg md:grid-cols-2">
        <div className="cell px-4 py-6 text-[13.5px] leading-relaxed">
          <p>
            Fans would love a price that depends on the game. Stores have never offered one, because if the team loses the store eats the discount on every item it sold that week. No insurer writes &ldquo;Texas lose&rdquo; cover by the hoodie.
          </p>
          <p className="mt-4">
            A prediction market is exactly that insurer. On Gemini there is a live market on every game: a contract that pays $1.00 if Texas lose and nothing if they win, trading at the crowd&apos;s best guess of the odds. Clause buys the right amount of that contract the instant you pay.
          </p>
        </div>
        <div className="cell px-4 py-6 text-[13.5px] leading-relaxed">
          <p>
            Your payment goes into an escrow account on Solana as USDC. You never see a wallet: the store holds one for you the way it would hold a gift-card balance. When Gemini resolves the market, the escrow pays the store its share and returns yours, in two transactions nobody has to approve, file, or chase.
          </p>
          <p className="mt-4">That is what makes a clause a product and not a promise. There is no refunds desk. The result settles the market, and the market settles you.</p>
        </div>
      </div>

      <div className="grid-lines grid-cols-[1fr_auto] border-t border-fg">
        <div className="cell flex items-baseline gap-4 px-4 py-3">
          <span className="h-md">Worked example</span>
        </div>
        <div className="cell tag flex items-center px-4">Hoodie {cents(6800)} · &ldquo;Texas lose&rdquo; at {q.hedgePrice.toFixed(2)}</div>
      </div>
      <div className="grid-lines grid-cols-2 lg:grid-cols-5">
        <Fig label="You'd pay if they lose" v={cents(q.loseCents)} />
        <Fig label="So you pay today" v={cents(q.winCents)} />
        <Fig label="Back if they lose" v={cents(q.rebateCents)} acc />
        <Fig label={`Store buys at ${q.hedgePrice.toFixed(2)}`} v={`${q.contractsQty}×`} />
        <Fig label="Hedge costs" v={cents(q.hedgeCostCents)} />
      </div>
      <div className="grid-lines grid-cols-1 border-t border-fg md:grid-cols-2">
        <Outcome title="Texas win" keeps={q.winCents} pays={0} cost={q.hedgeCostCents} nets={q.merchantRevenueIfNoRebateCents} />
        <Outcome title="Texas lose" keeps={q.loseCents} pays={Math.round(q.contractsQty * 100)} cost={q.hedgeCostCents} nets={q.merchantRevenueIfRebateCents} />
      </div>
      <div className="grid-lines grid-cols-1 border-t border-fg md:grid-cols-[1fr_240px_240px]">
        <div className="cell px-4 py-4 text-[12px] text-mute">The two totals differ by rounding only. The store is indifferent to the result, which is the entire point.</div>
        <Link href="/" className="cell btn">
          <span>Build one</span>
          <span>→</span>
        </Link>
        <Link href="/merchant" className="cell btn btn-ghost">
          <span>Store ledger</span>
          <span>→</span>
        </Link>
      </div>
    </div>
  );
}

function Fig({ label, v, acc }: { label: string; v: string; acc?: boolean }) {
  return (
    <div className={`cell px-4 py-4 ${acc ? "cell-acc" : ""}`}>
      <div className={`tag ${acc ? "tag-fg opacity-70" : ""}`}>{label}</div>
      <div className="num-lg mt-2">{v}</div>
    </div>
  );
}

function Outcome({ title, keeps, pays, cost, nets }: { title: string; keeps: number; pays: number; cost: number; nets: number }) {
  return (
    <div className="cell px-4 py-4">
      <div className="h-md">{title}</div>
      <table className="ledger mt-3">
        <tbody>
          <tr>
            <td>Store keeps</td>
            <td className="r font-bold">{cents(keeps)}</td>
          </tr>
          <tr>
            <td>Hedge pays</td>
            <td className="r font-bold">{pays ? cents(pays) : "–"}</td>
          </tr>
          <tr>
            <td>Hedge cost</td>
            <td className="r font-bold">−{cents(cost)}</td>
          </tr>
          <tr>
            <td className="font-bold">Store nets</td>
            <td className="r">
              <span className="num-md">{cents(nets)}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <Blocks fill={nets / 7000} className="mt-4" />
    </div>
  );
}
