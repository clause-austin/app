"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderRow, HedgeRow, ProductRow, FeedRow } from "@/lib/db";
import { cents } from "@/lib/pricing";
import { useFeed } from "./useFeed";
import { FeedList } from "./FeedList";
import { Blocks } from "./Blocks";
import { condition, isCryptoTicker } from "@/lib/phrase";

type Payload = {
  order: OrderRow;
  product: ProductRow;
  buyer: { name: string; pubkey: string };
  hedge: HedgeRow | null;
  feed: FeedRow[];
  voice: { script: string | null; elevenlabs: boolean };
};

export function Receipt({ id }: { id: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [missing, setMissing] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(`/api/orders/${id}`, { cache: "no-store" });
    if (r.status === 404) return setMissing(true);
    setData((await r.json()) as Payload);
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const { rows } = useFeed(id, () => {
    load();
  });

  const spokenFor = useRef<string | null>(null);
  const [voiceState, setVoiceState] = useState<"idle" | "playing" | "done">("idle");
  const speak = useCallback(async () => {
    if (!data?.order.settled_at) return;
    setVoiceState("playing");
    try {
      const r = await fetch(`/api/voice/${id}`);
      if (r.status === 200) {
        const blob = await r.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        audio.onended = () => setVoiceState("done");
        await audio.play();
        return;
      }
      const script = decodeURIComponent(r.headers.get("x-voice-script") ?? "") || data.voice.script || "";
      if (script && "speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(script);
        u.rate = 1.02;
        u.onend = () => setVoiceState("done");
        u.onerror = () => setVoiceState("done");
        window.speechSynthesis.speak(u);
        setTimeout(() => setVoiceState("done"), 20_000);
      } else setVoiceState("done");
    } catch {
      setVoiceState("done");
    }
  }, [data, id]);

  useEffect(() => {
    if (!data?.order.settled_at) return;
    if (spokenFor.current === id) return;
    const sawSettlement = rows.some((r) => r.kind === "settlement" && r.created_at > Date.now() - 60_000);
    if (sawSettlement) {
      spokenFor.current = id;
      speak();
    }
  }, [data?.order.settled_at, rows, id, speak]);

  if (missing) {
    return (
      <div className="px-4 py-20">
        <div className="h-lg">No such order.</div>
        <Link href="/" className="mt-4 inline-block font-bold underline">
          Back to goods
        </Link>
      </div>
    );
  }
  if (!data) return <div className="tag px-4 py-24 text-center">Loading</div>;

  const { order: o, product, buyer, hedge } = data;
  const hasClause = Boolean(o.event_ticker);
  const settled = o.status === "settled" || o.status === "rebated";
  const triggered = o.outcome === "rebate";
  const rebateSide: "yes" | "no" = o.rebate_side === "no" ? "no" : "yes";
  const happened: "yes" | "no" = triggered ? rebateSide : rebateSide === "no" ? "yes" : "no";
  const clauseText = condition(o.contract_label, o.event_ticker, rebateSide);
  const resultText = condition(o.contract_label, o.event_ticker, happened, "past");
  const crypto = isCryptoTicker(o.event_ticker);
  const rebate = hasClause ? o.paid_cents - o.lose_cents! : 0;
  const finalPaid = settled && triggered ? o.lose_cents! : o.paid_cents;

  const headline = settled ? (triggered ? "Triggered." : hasClause ? "No rebate." : "Done.") : hasClause ? (crypto ? "Waiting on the market." : "Waiting on the game.") : "Done.";
  const sub = settled
    ? triggered
      ? `${resultText}. ${cents(rebate)} is back in your balance. The ${product.name} cost you ${cents(o.lose_cents!)}.`
      : hasClause
        ? `${resultText}, so the clause didn't trigger. Your payment has been released to the store.`
        : "Paid in full, no clause attached."
    : hasClause
      ? `Your payment is in escrow and the store has already hedged your clause. Nobody has to do anything when the ${crypto ? "window closes" : "game ends"}.`
      : "Paid in full, no clause attached.";

  const steps: { t: string; d: string; at?: number | null; state: "done" | "active" | "todo"; href?: string | null }[] = [
    { t: "Paid into escrow", d: `${cents(o.paid_cents)} USDC`, at: o.created_at, state: "done", href: o.pay_tx ? explorer(o.pay_tx) : null },
    ...(hasClause
      ? [
          {
            t: "Store hedged your clause",
            d: hedge ? `${hedge.quantity} × ${o.contract_label} ${o.rebate_side?.toUpperCase()} at ${hedge.price} on Gemini (${hedge.venue})` : "Placing the matching order on Gemini",
            at: hedge?.created_at ?? null,
            state: (hedge ? "done" : "active") as "done" | "active",
          },
          {
            t: settled ? resultText : `${o.event_title}`,
            d: settled ? "Market resolved on Gemini" : o.expiry_at ? `Resolves ${new Date(o.expiry_at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}` : crypto ? "Resolves when the window closes" : "Resolves after the game",
            at: o.settled_at ?? null,
            state: (settled ? "done" : hedge ? "active" : "todo") as "done" | "active" | "todo",
          },
        ]
      : []),
    {
      t: settled ? (triggered ? `${cents(rebate)} sent back to you` : "Payment released to the store") : "Escrow releases on resolution",
      d: settled ? (triggered ? `Store received ${cents(o.lose_cents!)}` : `Store received ${cents(o.paid_cents)}`) : "Automatic, two transactions",
      at: o.settled_at ?? null,
      state: (settled ? "done" : "todo") as "done" | "active" | "todo",
      href: o.rebate_tx ? explorer(o.rebate_tx) : o.settle_tx ? explorer(o.settle_tx) : null,
    },
  ];

  return (
    <div className="grid-lines grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
      {/* Left */}
      <div className="cell"><div className="flex flex-col lg:sticky lg:top-[49px]">
        <div className="flex items-center justify-between border-b border-fg">
          <span className="tag px-4 py-2">Order {o.id}</span>
          <span className="tag px-4">{new Date(o.created_at).toLocaleString()}</span>
        </div>
        <div className={`px-4 pt-8 pb-6 ${settled && triggered ? "cell-acc" : ""}`}>
          <h1 className="h-lg break-words">{headline}</h1>
          <p className={`mt-5 max-w-[46ch] text-[13px] leading-relaxed ${settled && triggered ? "" : "text-mute"}`}>{sub}</p>
        </div>
        <div className="grid-lines grid-cols-[120px_1fr] border-t border-fg">
          <div className="cell relative bg-faint">
            <Image src={product.image} alt="" fill unoptimized={!product.image.startsWith("/products/")} sizes="120px" className="object-cover" />
          </div>
          <div className="cell px-4 py-4">
            <div className="text-[16px] font-extrabold uppercase leading-none">{product.name}</div>
            <div className="tag mt-1">for {buyer.name}</div>
            {hasClause && (
              <div className="mt-3 text-[12px]">
                Clause: <b>{clauseText}</b> · {o.event_title}
              </div>
            )}
          </div>
        </div>
        <div className="grid-lines grid-cols-3 border-t border-fg">
          <div className="cell px-4 py-4">
            <div className="tag">{settled ? "Paid" : "Paid today"}</div>
            <div className={`num-lg mt-1 ${settled && triggered ? "strike" : ""}`}>{cents(o.paid_cents)}</div>
          </div>
          <div className="cell px-4 py-4">
            <div className="tag">{hasClause ? "Back if triggered" : "Rebate"}</div>
            <div className="num-lg mt-1 text-acc">{hasClause ? cents(rebate) : "–"}</div>
          </div>
          <div className="cell px-4 py-4">
            <div className="tag">{settled ? "Final" : "If triggered"}</div>
            <div className="num-lg mt-1">{hasClause ? cents(settled ? finalPaid : o.lose_cents!) : cents(o.paid_cents)}</div>
          </div>
        </div>
        {hasClause && (
          <div className="border-t border-fg px-4 py-4">
            <div className="flex justify-between">
              <span className="tag">Share of payment at risk for the store</span>
              <span className="tag">hedged {hedge ? "✓" : "…"}</span>
            </div>
            <Blocks fill={rebate / o.paid_cents} acc className="mt-2" />
          </div>
        )}
        <div className="grid-lines grid-cols-2 border-t border-fg">
          {settled ? (
            <button onClick={speak} disabled={voiceState === "playing"} className="cell btn">
              <span>{voiceState === "playing" ? "Reading" : "Hear the result"}</span>
              <span className="text-[10px] opacity-60">{data.voice.elevenlabs ? "ElevenLabs" : "browser"}</span>
            </button>
          ) : (
            <Link href="/" className="cell btn">
              <span>Keep shopping</span>
              <span>→</span>
            </Link>
          )}
          <Link href="/orders" className="cell btn btn-ghost">
            <span>All orders</span>
            <span>→</span>
          </Link>
        </div>
      </div>
      </div>

      {/* Right */}
      <div className="cell">
        <div className="tag border-b border-fg px-4 py-2">Timeline</div>
        <ol>
          {steps.map((s, i) => (
            <li key={i} className="grid grid-cols-[28px_1fr_auto] gap-3 border-b border-fg px-4 py-4">
              <span className={`mt-[3px] h-3.5 w-3.5 ${s.state === "done" ? "bg-fg" : s.state === "active" ? "live bg-acc" : "border border-fg"}`} />
              <div className="min-w-0">
                <div className={`text-[14px] font-bold uppercase leading-tight ${s.state === "todo" ? "text-mute" : ""}`}>{s.t}</div>
                <div className="mt-1 text-[12px] text-mute">{s.d}</div>
                {s.href && (
                  <a href={s.href} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] font-bold uppercase tracking-[0.1em] text-acc hover:underline">
                    explorer ↗
                  </a>
                )}
              </div>
              <span className="text-[11px] text-mute">{s.at ? new Date(s.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}</span>
            </li>
          ))}
        </ol>

        <div className="tag border-b border-fg px-4 py-2">Under the hood</div>
        <dl className="grid grid-cols-[130px_1fr] gap-y-2 border-b border-fg px-4 py-4 text-[11.5px]">
          <dt className="text-mute">buyer wallet</dt>
          <dd className="truncate">{buyer.pubkey}</dd>
          {o.contract_symbol && (
            <>
              <dt className="text-mute">gemini contract</dt>
              <dd className="truncate">{o.contract_symbol}</dd>
              <dt className="text-mute">hedge</dt>
              <dd>{hedge ? `${hedge.quantity} @ ${hedge.price} = ${cents(hedge.cost_cents)} · ${hedge.venue}` : "pending"}</dd>
              <dt className="text-mute">store nets</dt>
              <dd>
                {cents(o.paid_cents - (hedge?.cost_cents ?? 0))} either way · list {cents(o.base_cents)} + fee {cents(o.fee_cents)}
              </dd>
            </>
          )}
        </dl>
        <div className="tag border-b border-fg px-4 py-2">Activity</div>
        <FeedList rows={rows} compact />
      </div>
    </div>
  );
}

function explorer(sig: string) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}
