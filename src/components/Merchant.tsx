"use client";

import { condition } from "@/lib/phrase";
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
  orders: (OrderRow & { buyer: string; product: string; seller: string | null; hedge: HedgeRow | null })[];
};

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
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [token, setToken] = useState("");
  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { admin: boolean }) => setAdmin(j.admin))
      .catch(() => setAdmin(false));
  }, []);
  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
    setAdmin(r.ok);
    setMsg(r.ok ? null : "Wrong token.");
  }
  async function lock() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAdmin(false);
  }

  async function settle(eventTicker: string, contractSymbol: string, side: "yes" | "no") {
    setBusy(eventTicker + side);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "resolve", eventTicker, contractSymbol, resolutionSide: side }),
      });
      const j = (await r.json()) as { settled?: number; error?: string };
      setMsg(r.status === 403 ? "Unlock the desk first." : (j.error ?? `Settled ${j.settled} order${j.settled === 1 ? "" : "s"}.`));
      await load();
    } finally {
      setBusy(null);
    }
  }
  async function pollGemini() {
    setBusy("tick");
    const r = await fetch("/api/admin/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "tick" }) });
    const j = (await r.json()) as { settled?: number; error?: string };
    setMsg(j.error ?? (j.settled ? `Gemini settled ${j.settled}.` : "Checked Gemini: nothing has resolved yet."));
    setBusy(null);
    await load();
  }

  if (!data) return <div className="tag px-4 py-24 text-center">Opening the ledger</div>;

  const open = data.orders.filter((o) => o.event_ticker && (o.status === "paid" || o.status === "hedged"));
  const openEvents = Array.from(new Map(open.map((o) => [o.event_ticker!, o])).values());
  const neutral = data.pnl.baseline > 0 ? data.pnl.realised - data.pnl.baseline : 0;
  const I = data.integrations;
  const status: [string, string, boolean][] = [
    ["Gemini prices", I.gemini.marketData, I.gemini.marketData === "live"],
    ["Gemini hedging", I.gemini.hedging.startsWith("live") ? "live" : "paper", I.gemini.hedging.startsWith("live")],
    ["Solana", I.solana.rpc.includes("127.0.0.1") ? "local" : I.solana.network, true],
    ["Escrow watcher", I.quicknode === "streams" ? "QuickNode" : "RPC poll", I.quicknode === "streams"],
    ["Voice", I.elevenlabs === "live" ? "ElevenLabs" : "browser", I.elevenlabs === "live"],
    ["Copy", I.grok === "live" ? "Grok" : "template", I.grok === "live"],
  ];

  return (
    <div>
      <div className="grid-lines grid-cols-[1fr_auto] border-b border-fg">
        <div className="cell flex items-baseline gap-4 px-4 py-3">
          <span className="h-md">Ledger</span>
          <span className="tag">The store&apos;s side</span>
        </div>
        <div className="cell tag flex items-center gap-2 px-4">
          <span className={`inline-block h-2 w-2 ${connected ? "live bg-acc" : "bg-mute"}`} /> {connected ? "streaming" : "reconnecting"}
        </div>
      </div>

      {/* Integrations */}
      <div className="grid-lines grid-cols-2 border-b border-fg sm:grid-cols-3 lg:grid-cols-6">
        {status.map(([k, v, ok]) => (
          <div key={k} className="cell flex items-center justify-between px-4 py-2">
            <span className="tag">{k}</span>
            <span className={`text-[11px] font-bold uppercase ${ok ? "" : "text-mute"}`}>{v}</span>
          </div>
        ))}
      </div>

      {/* Figures */}
      <div className="grid-lines grid-cols-2 border-b border-fg lg:grid-cols-4">
        <Fig label="Clauses sold" v={String(data.pnl.clauses)} sub={`${data.pnl.orders} orders total`} />
        <Fig label="Locked in, open clauses" v={cents(data.pnl.openLocked)} sub="Identical either way the games go" acc />
        <Fig label="Realised vs list" v={`${neutral >= 0 ? "+" : ""}${cents(neutral)}`} sub={`${cents(data.pnl.realised)} on ${cents(data.pnl.baseline)} list`} />
        <Fig label="Sent back to buyers" v={cents(data.pnl.rebatedToFans)} sub={`hedges paid ${cents(data.pnl.hedgePayout)} · cost ${cents(data.pnl.hedgeCost)}`} />
      </div>

      <div className="grid-lines grid-cols-1 lg:grid-cols-[1.6fr_1fr]">
        <div className="cell">
          <div className="flex items-center justify-between border-b border-fg">
            <span className="tag px-4 py-2">Book</span>
            <span className="tag px-4">{data.orders.length} rows</span>
          </div>
          <div className="overflow-x-auto">
            <table className="ledger min-w-[680px]">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Clause</th>
                  <th className="r">Paid</th>
                  <th className="r">If triggers</th>
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
                        <div className="font-bold uppercase">{o.product}</div>
                        <div className="text-[11px] text-mute">
                          {o.buyer}
                          {o.seller ? ` · sold by ${o.seller}` : ""}
                        </div>
                      </td>
                      <td className="max-w-[200px] text-[12px]">
                        {o.event_ticker ? (
                          <>
                            <div className="truncate font-bold">
                              {condition(o.contract_label, o.event_ticker, o.rebate_side === "no" ? "no" : "yes")}
                            </div>
                            <div className="truncate text-mute">{o.event_title}</div>
                          </>
                        ) : (
                          <span className="text-mute">none</span>
                        )}
                      </td>
                      <td className="r font-bold">{cents(o.paid_cents)}</td>
                      <td className="r">{o.lose_cents !== null ? cents(o.lose_cents) : "–"}</td>
                      <td className="r whitespace-nowrap text-[12px]">
                        {o.hedge ? (
                          <>
                            <div>
                              {o.hedge.quantity} @ {o.hedge.price}
                            </div>
                            <div className="text-mute">{cents(o.hedge.cost_cents)}</div>
                          </>
                        ) : o.event_ticker ? (
                          <span className="live text-acc">placing</span>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="r font-bold">{cents(nets)}</td>
                      <td className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.08em]">
                        {o.status === "rebated" ? <span className="bg-acc px-1.5 py-0.5 text-acc-fg">triggered</span> : settled ? "settled" : <span className="text-mute">{o.status === "hedged" ? "open · hedged" : "open"}</span>}
                      </td>
                    </tr>
                  );
                })}
                {data.orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-mute">
                      No orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-y border-fg">
            <span className="tag px-4 py-2">Resolution desk</span>
            <button onClick={pollGemini} disabled={busy !== null || !admin} className="inv border-l border-fg px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em] disabled:opacity-50">
              {busy === "tick" ? "Checking" : "Check Gemini now"}
            </button>
          </div>
          <p className="border-b border-fg px-4 py-3 text-[12px] leading-relaxed text-mute">
            Gemini resolves each market when the game ends; the poller picks it up within 30 seconds. For a demo the result can be called here. Escrow, rebate and hedge accounting run exactly as for real, with the source recorded as demo.
          </p>
          {admin === false && (
            <form onSubmit={unlock} className="grid-lines grid-cols-[1fr_auto] border-b border-fg">
              <input value={token} onChange={(e) => setToken(e.target.value)} type="password" placeholder="Admin token to unlock the desk" className="field cell" />
              <button className="cell btn w-[140px]">
                <span>Unlock</span>
              </button>
            </form>
          )}
          {admin && (
            <div className="flex items-center justify-between border-b border-fg px-4 py-2">
              <span className="tag">Desk unlocked</span>
              <button onClick={lock} className="tag hover:text-fg">
                Lock
              </button>
            </div>
          )}
          {openEvents.length === 0 && <div className="tag px-4 py-4">No open clauses</div>}
          {openEvents.map((o) => (
            <div key={o.event_ticker} className="grid-lines grid-cols-1 border-b border-fg sm:grid-cols-[1fr_auto_auto]">
              <div className="cell px-4 py-3">
                <div className="font-bold uppercase">{o.event_title}</div>
                <div className="text-[11px] text-mute">
                  {open.filter((x) => x.event_ticker === o.event_ticker).length} open · resolves {o.expiry_at ? new Date(o.expiry_at).toLocaleString() : "on resolution"}
                </div>
              </div>
              <button onClick={() => settle(o.event_ticker!, o.contract_symbol!, "yes")} disabled={busy !== null || !admin} className="cell btn btn-ghost sm:w-[160px]">
                <span>{condition(o.contract_label, o.event_ticker, "yes")}</span>
              </button>
              <button onClick={() => settle(o.event_ticker!, o.contract_symbol!, "no")} disabled={busy !== null || !admin} className="cell btn sm:w-[160px]">
                <span>{condition(o.contract_label, o.event_ticker, "no")}</span>
              </button>
            </div>
          ))}
          {msg && <p className="px-4 py-3 text-[12px] font-bold">{msg}</p>}
        </div>

        <div className="cell">
          <div className="tag border-b border-fg px-4 py-2">Accounts</div>
          {data.wallets ? (
            Object.entries(data.wallets).map(([k, w]) => (
              <div key={k} className="flex items-center justify-between border-b border-fg px-4 py-3">
                <div>
                  <div className="font-bold uppercase">{k}</div>
                  <a href={w.href} target="_blank" rel="noreferrer" className="text-[11px] text-mute hover:text-acc">
                    {w.address.slice(0, 6)}…{w.address.slice(-6)}
                  </a>
                </div>
                <div className="text-right">
                  <div className="num-md">{cents(w.usdcCents)}</div>
                  {w.sol !== undefined && <div className="text-[11px] text-mute">{w.sol.toFixed(2)} SOL</div>}
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-4 text-mute">Keys not set up. Run npm run setup:solana.</div>
          )}
          <div className="tag border-b border-fg px-4 py-2">Wire</div>
          <div className="max-h-[640px] overflow-y-auto">
            <FeedList rows={rows} compact />
          </div>
        </div>
      </div>
    </div>
  );
}

function Fig({ label, v, sub, acc }: { label: string; v: string; sub: string; acc?: boolean }) {
  return (
    <div className={`cell px-4 py-4 ${acc ? "cell-acc" : ""}`}>
      <div className={`tag ${acc ? "tag-fg opacity-70" : ""}`}>{label}</div>
      <div className="num-lg mt-2">{v}</div>
      <div className={`mt-1 text-[11px] ${acc ? "opacity-70" : "text-mute"}`}>{sub}</div>
    </div>
  );
}
