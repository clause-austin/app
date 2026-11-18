"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderRow, HedgeRow, ProductRow, FeedRow } from "@/lib/db";
import { cents } from "@/lib/pricing";
import { useFeed } from "./useFeed";
import { FeedList } from "./FeedList";

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

  // Voice: play once when the order becomes settled while the page is open.
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
        window.speechSynthesis.speak(u);
      } else setVoiceState("done");
    } catch {
      setVoiceState("done");
    }
  }, [data, id]);

  useEffect(() => {
    if (!data?.order.settled_at) return;
    if (spokenFor.current === id) return;
    // Only auto-speak if the settlement happened while we were watching (feed delivered it).
    const sawSettlement = rows.some((r) => r.kind === "settlement" && r.created_at > Date.now() - 60_000);
    if (sawSettlement) {
      spokenFor.current = id;
      speak();
    }
  }, [data?.order.settled_at, rows, id, speak]);

  if (missing) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <div className="font-display text-3xl">No such order.</div>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          Back to the shop
        </Link>
      </div>
    );
  }
  if (!data) return <div className="mx-auto max-w-2xl px-4 py-24 text-center text-ink-3">Printing your receipt…</div>;

  const { order: o, product, buyer, hedge } = data;
  const hasClause = Boolean(o.event_ticker);
  const settled = o.status === "settled" || o.status === "rebated";
  const triggered = o.outcome === "rebate";
  const finalPaid = settled ? (triggered ? o.lose_cents! : o.paid_cents) : null;
  const teamWord = o.rebate_side === "no" ? "lose" : "win";

  const steps: { label: string; detail: string; state: "done" | "active" | "todo"; href?: string | null }[] = [
    { label: "Paid into escrow", detail: `${cents(o.paid_cents)} held safely until the result`, state: "done", href: o.pay_tx ? explorer(o.pay_tx) : null },
    ...(hasClause
      ? [
          {
            label: "Store hedged your clause",
            detail: hedge ? `Bought ${hedge.quantity} × ${o.contract_label} ${o.rebate_side?.toUpperCase()} at ${hedge.price} on Gemini` : "Placing the matching order on Gemini…",
            state: (hedge ? "done" : "active") as "done" | "active",
            href: null,
          },
          {
            label: settled ? `${o.contract_label} ${triggered ? teamWord === "lose" ? "lost" : "won" : teamWord === "lose" ? "won" : "lost"}` : `Waiting on ${o.event_title}`,
            detail: settled ? "Market settled on Gemini" : o.expiry_at ? `Settles after ${new Date(o.expiry_at).toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit" })}` : "Settles after the game",
            state: (settled ? "done" : hedge ? "active" : "todo") as "done" | "active" | "todo",
            href: null,
          },
        ]
      : []),
    {
      label: settled ? (triggered ? `${cents(o.paid_cents - o.lose_cents!)} sent back to you` : "Payment released to the store") : "Money moves itself",
      detail: settled ? (triggered ? `You ended up paying ${cents(o.lose_cents!)}` : `You paid ${cents(o.paid_cents)}`) : "Rebate or release happens automatically",
      state: (settled ? "done" : "todo") as "done" | "active" | "todo",
      href: o.rebate_tx ? explorer(o.rebate_tx) : o.settle_tx ? explorer(o.settle_tx) : null,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* Receipt paper */}
        <div className="receipt-edge bg-paper px-7 pt-7 pb-10 shadow-[0_30px_60px_-30px_rgba(60,30,0,0.5)]">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-display text-xl font-semibold">Clause</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-ink-3">Pay less if they lose</div>
            </div>
            <div className="text-right font-mono text-[11px] text-ink-3">
              <div>{o.id}</div>
              <div>{new Date(o.created_at).toLocaleString()}</div>
            </div>
          </div>

          <div className="my-5 border-t border-dashed border-line" />

          <div className="flex gap-4">
            <Image src={product.image} alt="" width={72} height={72} className="h-18 w-18 rounded-lg border border-line" />
            <div className="flex-1">
              <div className="font-display text-lg font-semibold leading-tight">{product.name}</div>
              <div className="text-xs text-ink-3">for {buyer.name}</div>
            </div>
            <div className="scoreboard text-lg">{cents(o.base_cents)}</div>
          </div>

          {hasClause && (
            <div className="mt-4 rounded-xl border border-orange/40 bg-orange-soft/40 p-3 text-sm">
              <div className="text-[10px] uppercase tracking-[0.18em] text-orange">Clause</div>
              <div className="mt-1 leading-snug">
                If <strong>{o.contract_label}</strong> {teamWord} ({o.event_title}), <strong>{cents(o.paid_cents - o.lose_cents!)}</strong> comes back.
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-ink-2">
                <div>
                  Paid today <span className="scoreboard font-semibold text-ink">{cents(o.paid_cents)}</span>
                </div>
                <div>
                  If it triggers <span className="scoreboard font-semibold text-ink">{cents(o.lose_cents!)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="my-5 border-t border-dashed border-line" />

          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-widest text-ink-3">{settled ? "Final price" : "Charged today"}</span>
            <span className="scoreboard text-3xl font-semibold">{cents(finalPaid ?? o.paid_cents)}</span>
          </div>

          {settled && (
            <div className="mt-6 text-center">
              <span className={`stamp text-lg ${triggered ? "text-green" : "text-ink-3"}`}>{triggered ? "Clause triggered" : hasClause ? "No rebate" : "Paid in full"}</span>
            </div>
          )}

          {settled && (
            <button onClick={speak} disabled={voiceState === "playing"} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-ink px-3 py-2.5 text-sm font-medium hover:bg-ink hover:text-cream disabled:opacity-60">
              <Speaker /> {voiceState === "playing" ? "Announcing…" : "Hear the result"}
              <span className="text-[10px] uppercase tracking-widest opacity-60">{data.voice.elevenlabs ? "ElevenLabs" : "browser voice"}</span>
            </button>
          )}
        </div>

        {/* Timeline */}
        <div>
          <h1 className="font-display text-4xl font-semibold">
            {settled ? (triggered ? "It triggered." : hasClause ? "Didn't trigger this time." : "All done.") : hasClause ? "Now we wait for the whistle." : "Thanks, it's yours."}
          </h1>
          <p className="mt-2 max-w-prose text-ink-2">
            {settled && triggered && `Your ${product.name} ended up costing ${cents(o.lose_cents!)}. The rebate is already in your balance.`}
            {settled && !triggered && hasClause && `${o.contract_label} ${teamWord === "lose" ? "won" : "lost"}, so the sticker-ish price stands. Your payment has been released to the store.`}
            {!settled && hasClause && "Your money is parked in escrow. The store has hedged your clause, so nobody needs to do anything at the end of the game. The result settles the market, the market settles you."}
            {!hasClause && "No clause on this one. Enjoy."}
          </p>

          <ol className="mt-8 space-y-0">
            {steps.map((s, i) => (
              <li key={i} className="relative flex gap-4 pb-7 last:pb-0">
                {i < steps.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-14px)] w-px bg-line" />}
                <span
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold ${
                    s.state === "done" ? "border-green bg-green text-cream" : s.state === "active" ? "live-dot border-orange bg-orange-soft text-orange" : "border-line bg-paper text-ink-3"
                  }`}
                >
                  {s.state === "done" ? "✓" : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium ${s.state === "todo" ? "text-ink-3" : ""}`}>{s.label}</div>
                  <div className="text-sm text-ink-3">{s.detail}</div>
                  {s.href && (
                    <a href={s.href} target="_blank" rel="noreferrer" className="mt-1 inline-block font-mono text-[11px] text-orange hover:underline">
                      view on explorer ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <details className="mt-10 rounded-2xl border border-line bg-paper">
            <summary className="cursor-pointer select-none px-5 py-3 text-sm font-medium">Under the hood</summary>
            <div className="border-t border-line px-5 py-4 text-xs text-ink-2">
              <dl className="grid grid-cols-[120px_1fr] gap-y-2">
                <dt className="text-ink-3">Your wallet</dt>
                <dd className="truncate font-mono">{buyer.pubkey}</dd>
                {o.contract_symbol && (
                  <>
                    <dt className="text-ink-3">Gemini contract</dt>
                    <dd className="font-mono">{o.contract_symbol}</dd>
                    <dt className="text-ink-3">Hedge</dt>
                    <dd>
                      {hedge ? `${hedge.quantity} contracts @ ${hedge.price} = ${cents(hedge.cost_cents)} (${hedge.venue})` : "pending"}
                    </dd>
                    <dt className="text-ink-3">Store nets</dt>
                    <dd>
                      {cents(o.paid_cents - (hedge?.cost_cents ?? 0))} either way (sticker {cents(o.base_cents)} + clause fee {cents(o.fee_cents)})
                    </dd>
                  </>
                )}
              </dl>
              <div className="mt-4">
                <div className="mb-1 text-[10px] uppercase tracking-widest text-ink-3">Activity</div>
                <FeedList rows={rows} compact />
              </div>
            </div>
          </details>

          <div className="mt-8 flex gap-3 text-sm">
            <Link href="/" className="rounded-full border border-ink px-5 py-2 font-medium hover:bg-ink hover:text-cream">
              Keep shopping
            </Link>
            <Link href="/orders" className="rounded-full px-5 py-2 text-ink-3 hover:text-ink">
              All my orders
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function explorer(sig: string) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

function Speaker() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 5a9 9 0 0 1 0 14" />
    </svg>
  );
}
