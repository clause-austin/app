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
      setMsg(j.error ?? `Settled ${j.settled} order${j.settled === 1 ? "" : "s"}.`);
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

  if (!data) return <div className="px-4 py-24 text-center text-ink-3">Opening the back office…</div>;

  const open = data.orders.filter((o) => o.event_ticker && (o.status === "paid" || o.status === "hedged"));
  const openEvents = Array.from(new Map(open.map((o) => [o.event_ticker!, o])).values());
  const neutral = data.pnl.baseline > 0 ? data.pnl.realised - data.pnl.baseline : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-ink-3">Back office</div>
          <h1 className="font-display text-4xl font-semibold">Clause desk</h1>
          <p className="mt-1 text-ink-2">Every clause sold, every hedge placed, every dollar either way.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <Pill ok label="Gemini market data" value="live" />
          <Pill ok={data.integrations.gemini.hedging.startsWith("live")} label="Gemini hedging" value={data.integrations.gemini.hedging} />
          <Pill ok label="Solana" value={data.integrations.solana.rpc.includes("127.0.0.1") ? "local validator" : data.integrations.solana.network} />
          <Pill ok={data.integrations.quicknode === "streams"} label="Escrow watcher" value={data.integrations.quicknode === "streams" ? "QuickNode Streams" : "RPC poller"} />
          <Pill ok={data.integrations.elevenlabs === "live"} label="Voice" value={data.integrations.elevenlabs === "live" ? "ElevenLabs" : "browser"} />
          <Pill ok={data.integrations.grok === "live"} label="Checkout copy" value={data.integrations.grok === "live" ? "Grok" : "template"} />
        </div>
      </div>

      {/* Tiles */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Clauses sold" value={String(data.pnl.clauses)} sub={`${data.pnl.orders} orders total`} />
        <Tile label="Revenue locked in, open clauses" value={cents(data.pnl.openLocked)} sub="Identical whichever way the games go" accent />
        <Tile label="Realised vs sticker" value={`${neutral >= 0 ? "+" : ""}${cents(neutral)}`} sub={`${cents(data.pnl.realised)} earned on ${cents(data.pnl.baseline)} of sticker price`} />
        <Tile label="Sent back to fans" value={cents(data.pnl.rebatedToFans)} sub={`Hedges paid ${cents(data.pnl.hedgePayout)} · cost ${cents(data.pnl.hedgeCost)}`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {/* Orders */}
          <section className="rounded-2xl border border-line bg-paper">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="font-display text-xl font-semibold">Clause book</h2>
              <span className="text-xs text-ink-3">{data.orders.length} rows</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-ink-3">
                  <tr className="[&>th]:px-4 [&>th]:py-2">
                    <th>Order</th>
                    <th>Clause</th>
                    <th className="text-right">Paid</th>
                    <th className="text-right">If triggers</th>
                    <th className="text-right">Hedge</th>
                    <th className="text-right">Nets</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {data.orders.map((o) => {
                    const settled = o.status === "settled" || o.status === "rebated";
                    const nets = o.hedge ? o.paid_cents - o.hedge.cost_cents : o.paid_cents;
                    return (
                      <tr key={o.id} className="[&>td]:px-4 [&>td]:py-2.5">
                        <td>
                          <div className="font-medium">{o.product}</div>
                          <div className="text-xs text-ink-3">{o.buyer}</div>
                        </td>
                        <td className="max-w-[220px]">
                          {o.event_ticker ? (
                            <>
                              <div className="truncate">
                                {o.contract_label} {o.rebate_side === "no" ? "lose" : "win"}
                              </div>
                              <div className="truncate text-xs text-ink-3">{o.event_title}</div>
                            </>
                          ) : (
                            <span className="text-ink-3">none</span>
                          )}
                        </td>
                        <td className="tabular text-right">{cents(o.paid_cents)}</td>
                        <td className="tabular text-right">{o.lose_cents !== null ? cents(o.lose_cents) : "–"}</td>
                        <td className="tabular text-right text-xs">
                          {o.hedge ? (
                            <>
                              <div>
                                {o.hedge.quantity} @ {o.hedge.price}
                              </div>
                              <div className="text-ink-3">{cents(o.hedge.cost_cents)}</div>
                            </>
                          ) : o.event_ticker ? (
                            <span className="text-orange">placing…</span>
                          ) : (
                            "–"
                          )}
                        </td>
                        <td className="tabular text-right font-medium">{cents(nets)}</td>
                        <td>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              o.status === "rebated" ? "bg-green-soft text-green" : settled ? "bg-cream-2 text-ink-2" : "bg-orange-soft text-orange"
                            }`}
                          >
                            {o.status === "rebated" ? "rebated" : settled ? "settled" : o.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {data.orders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-ink-3">
                        No orders yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Settlement controls */}
          <section className="rounded-2xl border border-line bg-paper">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="font-display text-xl font-semibold">Settlement</h2>
              <button onClick={pollGemini} disabled={busy !== null} className="rounded-full border border-ink px-3 py-1 text-xs font-medium hover:bg-ink hover:text-cream disabled:opacity-50">
                {busy === "tick" ? "Checking…" : "Check Gemini now"}
              </button>
            </div>
            <div className="px-5 py-4 text-sm">
              <p className="text-ink-2">
                Gemini settles each market when the game ends and the poller picks it up within 30 seconds. For a demo you can call the result yourself; the money moves exactly as it would for real.
              </p>
              {openEvents.length === 0 && <div className="mt-4 text-ink-3">No open clauses.</div>}
              <ul className="mt-4 space-y-2">
                {openEvents.map((o) => (
                  <li key={o.event_ticker} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-cream px-4 py-3">
                    <div>
                      <div className="font-medium">{o.event_title}</div>
                      <div className="text-xs text-ink-3">
                        {open.filter((x) => x.event_ticker === o.event_ticker).length} open clause(s) · settles {o.expiry_at ? new Date(o.expiry_at).toLocaleString() : "after the game"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => settle(o.event_ticker!, o.contract_symbol!, "yes")} disabled={busy !== null} className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-cream hover:bg-orange disabled:opacity-50">
                        {o.contract_label} win
                      </button>
                      <button onClick={() => settle(o.event_ticker!, o.contract_symbol!, "no")} disabled={busy !== null} className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-cream hover:bg-orange disabled:opacity-50">
                        {o.contract_label} lose
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {msg && <p className="mt-3 text-xs text-ink-2">{msg}</p>}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {/* Wallets */}
          <section className="rounded-2xl border border-line bg-paper">
            <div className="border-b border-line px-5 py-3">
              <h2 className="font-display text-xl font-semibold">Wallets</h2>
            </div>
            <ul className="divide-y divide-line/70 text-sm">
              {data.wallets ? (
                Object.entries(data.wallets).map(([k, w]) => (
                  <li key={k} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <div className="font-medium capitalize">{k}</div>
                      <a href={w.href} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-ink-3 hover:text-orange">
                        {w.address.slice(0, 6)}…{w.address.slice(-6)}
                      </a>
                    </div>
                    <div className="text-right">
                      <div className="scoreboard font-semibold">{cents(w.usdcCents)}</div>
                      {w.sol !== undefined && <div className="text-[11px] text-ink-3">{w.sol.toFixed(2)} SOL for fees</div>}
                    </div>
                  </li>
                ))
              ) : (
                <li className="px-5 py-4 text-ink-3">Keys not set up. Run npm run setup:solana.</li>
              )}
            </ul>
          </section>

          {/* Feed */}
          <section className="rounded-2xl border border-line bg-paper">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="font-display text-xl font-semibold">Live wire</h2>
              <span className="flex items-center gap-1.5 text-xs text-ink-3">
                <span className={`h-2 w-2 rounded-full ${connected ? "live-dot bg-green" : "bg-line"}`} /> {connected ? "streaming" : "reconnecting"}
              </span>
            </div>
            <div className="max-h-[560px] overflow-y-auto px-5">
              <FeedList rows={rows} compact />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Pill({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${ok ? "border-green/40 bg-green-soft/60 text-green" : "border-line bg-paper text-ink-3"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-green" : "bg-ink-3"}`} />
      {label}: <span className="font-semibold">{value}</span>
    </span>
  );
}

function Tile({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? "border-orange bg-orange-soft/40" : "border-line bg-paper"}`}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-ink-3">{label}</div>
      <div className="scoreboard mt-1 text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-ink-2">{sub}</div>
    </div>
  );
}
