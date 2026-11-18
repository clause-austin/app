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
      <div className="mx-auto max-w-xl px-4 py-24">
        <div className="serif text-[40px]">No such instrument.</div>
        <Link href="/" className="link mt-4 inline-block text-sm">
          Back to Schedule A
        </Link>
      </div>
    );
  }
  if (!data) return <div className="label px-4 py-24 text-center">Preparing the counterpart</div>;

  const { order: o, product, buyer, hedge } = data;
  const hasClause = Boolean(o.event_ticker);
  const settled = o.status === "settled" || o.status === "rebated";
  const triggered = o.outcome === "rebate";
  const teamWord = o.rebate_side === "no" ? "lose" : "win";
  const resultWord = settled ? (triggered ? (teamWord === "lose" ? "lost" : "won") : teamWord === "lose" ? "won" : "lost") : null;
  const rebate = hasClause ? o.paid_cents - o.lose_cents! : 0;

  const headline = settled ? (triggered ? "Satisfied." : hasClause ? "Discharged." : "Complete.") : hasClause ? "Awaiting the result." : "Complete.";
  const sub = settled
    ? triggered
      ? `${o.contract_label} ${resultWord}. ${cents(rebate)} has been returned, so the ${product.name} cost ${cents(o.lose_cents!)}.`
      : hasClause
        ? `${o.contract_label} ${resultWord}, so the condition was not met. The consideration has been released to the store.`
        : "Paid in full, no condition attached."
    : hasClause
      ? "The consideration is in escrow and the store has hedged your clause. Nobody needs to do anything when the game ends."
      : "Paid in full, no condition attached.";

  const steps: { t: string; d: string; at?: number | null; state: "done" | "active" | "todo"; href?: string | null }[] = [
    { t: "Consideration paid into escrow", d: `${cents(o.paid_cents)} USDC`, at: o.created_at, state: "done", href: o.pay_tx ? explorer(o.pay_tx) : null },
    ...(hasClause
      ? [
          {
            t: "Store hedged the condition",
            d: hedge ? `${hedge.quantity} × ${o.contract_label} ${o.rebate_side?.toUpperCase()} at ${hedge.price} on Gemini (${hedge.venue})` : "Placing the matching order on Gemini",
            at: hedge?.created_at ?? null,
            state: (hedge ? "done" : "active") as "done" | "active",
          },
          {
            t: settled ? `Market resolved: ${o.contract_label} ${resultWord}` : `Market resolves after ${o.event_title}`,
            d: settled ? "Read from Gemini's resolution" : o.expiry_at ? `Expected ${new Date(o.expiry_at).toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit" })}` : "After the game",
            at: o.settled_at ?? null,
            state: (settled ? "done" : hedge ? "active" : "todo") as "done" | "active" | "todo",
          },
        ]
      : []),
    {
      t: settled ? (triggered ? `${cents(rebate)} returned to the Buyer` : "Consideration released to the Store") : "Escrow releases on resolution",
      d: settled ? (triggered ? `Store received ${cents(o.lose_cents!)}` : `Store received ${cents(o.paid_cents)}`) : "Automatic, in two transactions",
      at: o.settled_at ?? null,
      state: (settled ? "done" : "todo") as "done" | "active" | "todo",
      href: o.rebate_tx ? explorer(o.rebate_tx) : o.settle_tx ? explorer(o.settle_tx) : null,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6">
      <div className="grid md:grid-cols-[1fr_1.35fr]">
        {/* Left: status */}
        <div className="py-12 md:sticky md:top-[57px] md:self-start md:py-14 md:pr-12">
          <div className="label">Executed counterpart</div>
          <h1 className="serif mt-4 text-[56px] leading-[0.95] md:text-[72px]">
            {settled && triggered ? <em className="text-red">{headline}</em> : headline}
          </h1>
          <p className="mt-6 max-w-[40ch] text-[14px] leading-relaxed text-ink-2">{sub}</p>

          {settled && (
            <div className="mt-8 flex items-center gap-6">
              <div className={`seal ${triggered ? "text-red" : "text-ink"}`}>
                <span>
                  {triggered ? "Satisfied" : hasClause ? "Discharged" : "Paid"}
                  <br />
                  {new Date(o.settled_at!).toLocaleDateString("en-US", { month: "short", day: "2-digit" })}
                </span>
              </div>
              <button onClick={speak} disabled={voiceState === "playing"} className="btn btn-ghost btn-sm">
                {voiceState === "playing" ? "Reading" : "Read aloud"}
                <span className="opacity-50">{data.voice.elevenlabs ? "ElevenLabs" : "browser"}</span>
              </button>
            </div>
          )}

          <div className="mt-10 border-t border-line pt-5">
            <div className="flex items-baseline justify-between">
              <span className="label">{settled ? "Final price" : "Paid today"}</span>
              <span className="num text-[34px] leading-none">{cents(settled && triggered ? o.lose_cents! : o.paid_cents)}</span>
            </div>
            {settled && triggered && (
              <div className="mt-2 flex items-baseline justify-between">
                <span className="label">Was</span>
                <span className="num redline text-[16px]">{cents(o.paid_cents)}</span>
              </div>
            )}
          </div>

          <div className="mt-8 flex gap-3">
            <Link href="/" className="btn btn-ghost btn-sm">
              Schedule A
            </Link>
            <Link href="/orders" className="btn btn-ghost btn-sm">
              All instruments
            </Link>
          </div>
        </div>

        {/* Right: the document */}
        <div className="border-t border-line py-12 md:border-t-0 md:border-l md:py-14 md:pl-12">
          <div className="mono flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-ink-3">
            <span>{o.id}</span>
            <span>{new Date(o.created_at).toLocaleString()}</span>
          </div>

          <div className="mt-8 space-y-7">
            <Article n="§ 1" title="Parties">
              Between <span className="underline decoration-line underline-offset-4">{buyer.name}</span> (&ldquo;the Buyer&rdquo;) and Clause (&ldquo;the Store&rdquo;).
            </Article>
            <Article n="§ 2" title="Goods">
              <span className="flex items-start gap-4">
                <Image src={product.image} alt="" width={56} height={56} className="art mt-1 h-14 w-14 shrink-0 border border-line" />
                <span>
                  One <em>{product.name}</em>, listed at <span className="figure">{cents(o.base_cents)}</span>.
                </span>
              </span>
            </Article>
            {hasClause ? (
              <>
                <Article n="§ 3" title="Condition">
                  Should <span className="underline decoration-line underline-offset-4">{o.contract_label}</span> {teamWord} in {o.event_title}, this instrument is <em>satisfied</em>.
                  {settled && (
                    <span className={`ml-2 inline-block align-middle font-sans text-[11px] uppercase tracking-[0.14em] ${triggered ? "text-red" : "text-ink-3"}`}>
                      {triggered ? "· satisfied" : "· not satisfied"}
                    </span>
                  )}
                </Article>
                <Article n="§ 4" title="Consideration">
                  The Buyer paid <span className="figure redline">{cents(o.base_cents)}</span> <span className="figure">{cents(o.paid_cents)}</span>. If satisfied, the Store returns{" "}
                  <span className="figure text-red">{cents(rebate)}</span>, so that the Buyer will have paid <span className="figure">{cents(o.lose_cents!)}</span>.
                </Article>
                <Article n="§ 5" title="Hedge">
                  {hedge ? (
                    <>
                      The Store purchased <span className="figure">{hedge.quantity}</span> &ldquo;{o.contract_label} {teamWord}&rdquo; contracts at <span className="figure">{hedge.price}</span>, costing{" "}
                      <span className="figure">{cents(hedge.cost_cents)}</span>. The Store nets <span className="figure">{cents(o.paid_cents - hedge.cost_cents)}</span> in either event.
                    </>
                  ) : (
                    <>The Store is placing the matching order on Gemini.</>
                  )}
                </Article>
                <Article n="§ 6" title="Settlement">
                  Held in USDC escrow on Solana. Released by Gemini&apos;s resolution without further act of either party.
                </Article>
              </>
            ) : (
              <Article n="§ 3" title="Condition">
                None attaches. The Buyer paid <span className="figure">{cents(o.paid_cents)}</span>.
              </Article>
            )}
          </div>

          <div className="mt-14">
            <div className="label">Schedule B · Performance</div>
            <ol className="mt-4 border-t border-ink">
              {steps.map((s, i) => (
                <li key={i} className="grid grid-cols-[20px_1fr] gap-4 border-b border-line-2 py-4 md:grid-cols-[20px_1fr_150px]">
                  <span className={`mt-[7px] h-2.5 w-2.5 ${s.state === "done" ? "bg-ink" : s.state === "active" ? "live bg-red" : "border border-line"}`} />
                  <div className="min-w-0">
                    <div className={`text-[14px] ${s.state === "todo" ? "text-ink-3" : ""}`}>{s.t}</div>
                    <div className="mt-0.5 text-[12px] text-ink-3">{s.d}</div>
                    {s.href && (
                      <a href={s.href} target="_blank" rel="noreferrer" className="label mt-1 inline-block !text-red hover:underline underline-offset-4">
                        explorer ↗
                      </a>
                    )}
                  </div>
                  <div className="mono col-start-2 text-[11px] text-ink-3 md:col-start-3 md:text-right">{s.at ? new Date(s.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}</div>
                </li>
              ))}
            </ol>
          </div>

          <details className="group mt-12">
            <summary className="label cursor-pointer list-none select-none hover:!text-ink">
              Annex · technical particulars <span className="ml-1 inline-block transition group-open:rotate-90">→</span>
            </summary>
            <div className="mt-4 border-t border-line pt-4">
              <dl className="mono grid grid-cols-[130px_1fr] gap-y-2 text-[11.5px]">
                <dt className="text-ink-3">buyer wallet</dt>
                <dd className="truncate">{buyer.pubkey}</dd>
                {o.contract_symbol && (
                  <>
                    <dt className="text-ink-3">gemini contract</dt>
                    <dd className="truncate">{o.contract_symbol}</dd>
                    <dt className="text-ink-3">hedge</dt>
                    <dd>{hedge ? `${hedge.quantity} @ ${hedge.price} = ${cents(hedge.cost_cents)} · ${hedge.venue}` : "pending"}</dd>
                    <dt className="text-ink-3">clause fee</dt>
                    <dd>{cents(o.fee_cents)}</dd>
                  </>
                )}
              </dl>
              <div className="mt-6">
                <div className="label mb-1">Activity</div>
                <FeedList rows={rows} compact />
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function Article({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[52px_1fr] gap-x-3 md:grid-cols-[96px_1fr]">
      <div className="pt-[9px]">
        <div className="sect">{n}</div>
        <div className="label mt-1 hidden md:block">{title}</div>
      </div>
      <div className="body-serif">{children}</div>
    </div>
  );
}

function explorer(sig: string) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}
