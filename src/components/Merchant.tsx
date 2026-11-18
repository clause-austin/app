"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrderRow, HedgeRow } from "@/lib/db";
import { cents } from "@/lib/pricing";
import { useFeed } from "./useFeed";
import { FeedList } from "./FeedList";

type Payload = {
  integrations: {
    solana: { rpc: string; mint: string; network: string };
    gemini: { marketData: string; hedging: string };
    elevenlabs: string;
    quicknode: string;
    grok: string;
  };
  wallets: Record<string, { address: string; usdcCents: number; sol?: number; href: string }> | null;
  pnl: { realised: number; baseline: number; openLocked: number; hedgeCost: number; hedgePayout: number; rebatedToFans: number; orders: number; clauses: number };
  orders: (OrderRow & { buyer: string; product: string; hedge: HedgeRow | null })[];
};

const ADMIN = "clause-demo";

export function Merchant() {
  const [data, setData] = useState<Payload | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/merchant", { cache: "no-store" });
    setData((await r.json()) as Payload);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);
  const { rows, connected } = useFeed(undefined, () => load());

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function settle(eventTicker: string, contractSymbol: string, side: "yes" | "no") {
    setBusy(eventTicker + side);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/resolve", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": ADMIN },
        body: JSON.stringify({ action: "resolve", eventTicker, contractSymbol, resolutionSide: side }),
      });
      const j = (await r.json()) as { settled?: number; error?: string };
      setMsg(j.error ?? `Settled ${j.settled} instrument${j.settled === 1 ? "" : "s"}.`);
      await load();
    } finally {
      setBusy(null);
    }
  }
  async function pollGemini() {
    setBusy("tick");
    const r = await fetch("/api/admin/resolve", { method: "POST", headers: { "content-type": "application/json", "x-admin-token": ADMIN }, body: JSON.stringify({ action: "tick" }) });
    const j = (await r.json()) as { settled?: number; error?: string };
    setMsg(j.error ?? (j.settled ? `Gemini settled ${j.settled}.` : "Checked Gemini: nothing has resolved yet."));
    setBusy(null);
    await load();
  }

  if (!data) return <div className="label px-4 py-24 text-center">Opening the ledger</div>;

  const open = data.orders.filter((o) => o.event_ticker && (o.status === "paid" || o.status === "hedged"));
  const openEvents = Array.from(new Map(open.map((o) => [o.event_ticker!, o])).values());
  const neutral = data.pnl.baseline > 0 ? data.pnl.realised - data.pnl.baseline : 0;
  const I = data.integrations;
  const status: [string, string, boolean][] = [
    ["gemini prices", I.gemini.marketData, I.gemini.marketData === "live"],
    ["gemini hedging", I.gemini.hedging.startsWith("live") ? "live" : "paper", I.gemini.hedging.startsWith("live")],
    ["solana", I.solana.rpc.includes("127.0.0.1") ? "local validator" : I.solana.network, true],
    ["escrow watcher", I.quicknode === "streams" ? "quicknode streams" : "rpc poller", I.quicknode === "streams"],
    ["voice", I.elevenlabs === "live" ? "elevenlabs" : "browser", I.elevenlabs === "live"],
    ["copy", I.grok === "live" ? "grok" : "template", I.grok === "live"],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="label">The store&apos;s side</div>
          <h1 className="serif mt-2 text-[44px] leading-none">Ledger</h1>
        </div>
        <ul className="mono grid grid-cols-2 gap-x-8 gap-y-1 text-[11px] sm:grid-cols-3">
          {status.map(([k, v, ok]) => (
            <li key={k} className="flex items-center gap-2">
              <span className={`inline-block h-1.5 w-1.5 ${ok ? "bg-ink" : "border border-ink-3"}`} />
              <span className="text-ink-3">{k}</span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Figures */}
      <div className="mt-10 grid border-y border-ink sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Clauses written" value={String(data.pnl.clauses)} sub={`${data.pnl.orders} instruments in all`} />
        <Figure label="Revenue locked, open clauses" value={cents(data.pnl.openLocked)} sub="Identical whichever way the games go" />
        <Figure label="Realised against list" value={`${neutral >= 0 ? "+" : ""}${cents(neutral)}`} sub={`${cents(data.pnl.realised)} on ${cents(data.pnl.baseline)} of list`} />
        <Figure label="Returned to buyers" value={cents(data.pnl.rebatedToFans)} sub={`hedges paid ${cents(data.pnl.hedgePayout)} · cost ${cents(data.pnl.hedgeCost)}`} />
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-12">
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="label">Book</h2>
              <span className="mono text-[11px] text-ink-3">{data.orders.length} rows</span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="ledger min-w-[640px]">
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>Condition</th>
                    <th className="r">Paid</th>
                    <th className="r">If satisfied</th>
                    <th className="r">Hedge</th>
                    <th className="r">Nets</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => {
                    const settled = o.status === "settled" || o.status === "rebated";
                    const nets = o.hedge ? o.paid_cents - o.hedge.cost_cents : o.paid_cents;
                    return (
                      <tr key={o.id}>
                        <td>
                          <div className="text-[13px]">{o.product}</div>
                          <div className="mono text-[11px] text-ink-3">{o.buyer}</div>
                        </td>
                        <td className="max-w-[220px] text-[12.5px]">
                          {o.event_ticker ? (
                            <>
                              <div className="truncate">
                                {o.contract_label} {o.rebate_side === "no" ? "lose" : "win"}
                              </div>
                              <div className="truncate text-ink-3">{o.event_title}</div>
                            </>
                          ) : (
                            <span className="text-ink-3">none</span>
                          )}
                        </td>
                        <td className="num r">{cents(o.paid_cents)}</td>
                        <td className="num r">{o.lose_cents !== null ? cents(o.lose_cents) : "–"}</td>
                        <td className="num r whitespace-nowrap text-[12px]">
                          {o.hedge ? (
                            <>
                              <div>
                                {o.hedge.quantity} @ {o.hedge.price}
                              </div>
                              <div className="text-ink-3">{cents(o.hedge.cost_cents)}</div>
                            </>
                          ) : o.event_ticker ? (
                            <span className="live text-red">placing</span>
                          ) : (
                            "–"
                          )}
                        </td>
                        <td className="num r">{cents(nets)}</td>
                        <td className="mono text-[11px]">
                          {o.status === "rebated" ? <span className="text-red">satisfied</span> : settled ? "discharged" : <span className="text-ink-3">{o.status === "hedged" ? "open · hedged" : "open"}</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {data.orders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-ink-3">
                        No instruments yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="label">Resolution desk</h2>
              <button onClick={pollGemini} disabled={busy !== null} className="label !text-ink hover:underline underline-offset-4 disabled:opacity-50">
                {busy === "tick" ? "Checking" : "Check Gemini now"}
              </button>
            </div>
            <p className="mt-3 max-w-[64ch] text-[12.5px] leading-relaxed text-ink-2">
              Gemini resolves each market when the game ends and the poller picks it up within 30 seconds. For a demonstration the result can be called here; escrow, rebate and hedge accounting run exactly as they would for real, with the source recorded as <span className="mono">demo</span>.
            </p>
            {openEvents.length === 0 && <div className="label mt-5">No open clauses</div>}
            <ul className="mt-4 border-t border-ink">
              {openEvents.map((o) => (
                <li key={o.event_ticker} className="flex flex-wrap items-center justify-between gap-3 border-b border-line-2 py-3">
                  <div>
                    <div className="text-[13.5px]">{o.event_title}</div>
                    <div className="mono text-[11px] text-ink-3">
                      {open.filter((x) => x.event_ticker === o.event_ticker).length} open · resolves {o.expiry_at ? new Date(o.expiry_at).toLocaleString() : "after the game"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => settle(o.event_ticker!, o.contract_symbol!, "yes")} disabled={busy !== null} className="btn btn-ghost btn-sm">
                      {o.contract_label} win
                    </button>
                    <button onClick={() => settle(o.event_ticker!, o.contract_symbol!, "no")} disabled={busy !== null} className="btn btn-sm">
                      {o.contract_label} lose
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {msg && <p className="mono mt-3 text-[11.5px] text-ink-2">{msg}</p>}
          </section>
        </div>

        <div className="space-y-12">
          <section>
            <h2 className="label">Accounts</h2>
            <ul className="mt-3 border-t border-ink">
              {data.wallets ? (
                Object.entries(data.wallets).map(([k, w]) => (
                  <li key={k} className="flex items-center justify-between border-b border-line-2 py-3">
                    <div>
                      <div className="text-[13px] capitalize">{k}</div>
                      <a href={w.href} target="_blank" rel="noreferrer" className="mono text-[11px] text-ink-3 hover:text-red">
                        {w.address.slice(0, 6)}…{w.address.slice(-6)}
                      </a>
                    </div>
                    <div className="text-right">
                      <div className="num text-[15px]">{cents(w.usdcCents)}</div>
                      {w.sol !== undefined && <div className="mono text-[11px] text-ink-3">{w.sol.toFixed(2)} SOL</div>}
                    </div>
                  </li>
                ))
              ) : (
                <li className="py-4 text-ink-3">Keys not set up. Run npm run setup:solana.</li>
              )}
            </ul>
          </section>

          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="label">Wire</h2>
              <span className="mono flex items-center gap-2 text-[11px] text-ink-3">
                <span className={`inline-block h-1.5 w-1.5 ${connected ? "live bg-red" : "border border-ink-3"}`} /> {connected ? "streaming" : "reconnecting"}
              </span>
            </div>
            <div className="mt-3 max-h-[600px] overflow-y-auto border-t border-ink">
              <FeedList rows={rows} compact />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="border-b border-line-2 px-0 py-5 sm:border-b-0 sm:px-5 sm:first:pl-0 sm:[&:not(:first-child)]:border-l">
      <div className="label">{label}</div>
      <div className="num mt-2 text-[30px] leading-none">{value}</div>
      <div className="mt-2 text-[11.5px] text-ink-3">{sub}</div>
    </div>
  );
}
