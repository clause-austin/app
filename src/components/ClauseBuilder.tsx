"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GeminiEvent, GeminiContract } from "@/lib/gemini/public";
import { quote, loseBounds, cents, type Quote } from "@/lib/pricing";
import { openContracts, ask, kickoff, shortWhen, defaultContract } from "./market";
import { useBuyer } from "./buyer";

type Props = {
  product: { slug: string; name: string; priceCents: number };
  events: GeminiEvent[];
};

export function ClauseBuilder({ product, events }: Props) {
  const router = useRouter();
  const { buyer, balanceCents, signIn, topUp, refresh } = useBuyer();

  const [enabled, setEnabled] = useState(events.length > 0);
  const [eventTicker, setEventTicker] = useState(events[0]?.ticker ?? "");
  const event = useMemo(() => events.find((e) => e.ticker === eventTicker) ?? events[0], [events, eventTicker]);
  const contracts = useMemo(() => (event ? openContracts(event) : []), [event]);
  const [contractId, setContractId] = useState<string>(() => (event ? defaultContract(event)?.id ?? "" : ""));
  const contract: GeminiContract | undefined = contracts.find((c) => c.id === contractId) ?? contracts[0];
  const [when, setWhen] = useState<"lose" | "win">("lose");
  const rebateSide: "yes" | "no" = when === "lose" ? "no" : "yes";
  const askPrice = contract ? ask(contract, rebateSide) : NaN;
  const bounds = useMemo(() => (Number.isFinite(askPrice) ? loseBounds(product.priceCents, askPrice) : { min: 0, max: product.priceCents }), [askPrice, product.priceCents]);
  const [loseCents, setLoseCents] = useState(() => Math.round(product.priceCents * 0.3));
  useEffect(() => {
    setLoseCents((v) => Math.min(bounds.max, Math.max(bounds.min, v)));
  }, [bounds.min, bounds.max]);
  useEffect(() => {
    if (event) setContractId(defaultContract(event)?.id ?? "");
  }, [event]);

  const q: Quote | null = enabled && contract && Number.isFinite(askPrice) ? quote(product.priceCents, loseCents, askPrice) : null;

  const [explain, setExplain] = useState<{ text: string; source: string } | null>(null);
  const timer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!q || !event || !contract) {
      setExplain(null);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch("/api/copilot", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productName: product.name, eventTitle: event.title, teamLabel: contract.label, rebateWhen: when, quote: q }),
        });
        if (r.ok) setExplain(await r.json());
      } catch {
        /* ignore */
      }
    }, 450);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.winCents, q?.loseCents, contract?.id, when, event?.ticker]);

  const [name, setName] = useState("");
  const [busy, setBusy] = useState<"idle" | "funding" | "paying">("idle");
  const [err, setErr] = useState<string | null>(null);
  const due = q ? q.winCents : product.priceCents;
  const short = Math.max(0, due - balanceCents);

  async function buy() {
    setErr(null);
    try {
      if (!buyer) {
        if (!name.trim()) {
          setErr("Your name goes in the box above.");
          return;
        }
        await signIn(name);
      }
      if (short > 0) {
        setBusy("funding");
        await topUp(Math.min(50_000, Math.max(100, Math.ceil(short / 1000) * 1000)));
      }
      setBusy("paying");
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productSlug: product.slug,
          clause: q && event && contract ? { eventTicker: event.ticker, contractSymbol: contract.instrumentSymbol, rebateSide, loseCents: q.loseCents } : undefined,
        }),
      });
      const j = (await r.json()) as { order?: { id: string }; error?: string };
      if (!r.ok || !j.order) throw new Error(j.error ?? "Checkout failed");
      await refresh();
      router.push(`/orders/${j.order.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy("idle");
    }
  }

  const fill = bounds.max > bounds.min ? (loseCents - bounds.min) / (bounds.max - bounds.min) : 1;
  const nBlocks = Math.round(fill * 24);

  return (
    <div className="flex flex-col">
      {/* Mode */}
      <div className="grid-lines grid-cols-2 border-b border-fg">
        <button onClick={() => setEnabled(true)} disabled={events.length === 0} className={`seg cell ${enabled ? "on" : ""}`}>
          With clause
        </button>
        <button onClick={() => setEnabled(false)} className={`seg cell ${!enabled ? "on" : ""}`}>
          Without
        </button>
      </div>

      {enabled && event && contract && q ? (
        <>
          {/* Game */}
          <div className="border-b border-fg">
            <div className="tag px-4 pt-3">01 · The game</div>
            <select value={event.ticker} onChange={(e) => setEventTicker(e.target.value)} className="seg !pb-4 !pt-2 text-[15px]" aria-label="Game">
              {events.map((e) => (
                <option key={e.ticker} value={e.ticker}>
                  {e.title} · {shortWhen(kickoff(e))}
                </option>
              ))}
            </select>
          </div>

          {/* Team + condition */}
          <div className="grid-lines grid-cols-1 border-b border-fg sm:grid-cols-2">
            <div className="cell">
              <div className="tag px-4 pt-3">02 · The team</div>
              <div className="grid-lines mt-2 grid-cols-2 border-t border-fg">
                {contracts.map((c) => (
                  <button key={c.id} onClick={() => setContractId(c.id)} className={`seg cell truncate ${c.id === contract.id ? "on" : ""}`} title={c.label}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="cell">
              <div className="tag px-4 pt-3">03 · Pay less if they</div>
              <div className="grid-lines mt-2 grid-cols-2 border-t border-fg">
                {(["lose", "win"] as const).map((w) => (
                  <button key={w} onClick={() => setWhen(w)} className={`seg cell ${when === w ? "on" : ""}`}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Net price */}
          <div className="border-b border-fg px-4 pt-3 pb-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="tag">04 · If {contract.label} {when}, I want to have paid</div>
                <div className="num-xl mt-2">{cents(loseCents)}</div>
              </div>
              <div className="text-right">
                <div className="tag">Drag</div>
                <div className="text-[11px] text-mute">
                  {cents(bounds.min)} – {cents(bounds.max)}
                </div>
              </div>
            </div>
            <div className="blocks mt-5">
              {Array.from({ length: 24 }, (_, i) => (
                <i key={i} className={i < nBlocks ? "on" : ""} />
              ))}
              <input
                type="range"
                className="tick"
                min={bounds.min}
                max={bounds.max}
                step={100}
                value={loseCents}
                onChange={(e) => setLoseCents(Number(e.target.value))}
                aria-label="Net price if the clause triggers"
              />
            </div>
          </div>

          {/* The deal */}
          <div className="grid-lines grid-cols-2 border-b border-fg lg:grid-cols-4">
            <div className="cell px-4 py-4">
              <div className="tag">Pay today</div>
              <div className="mt-2 text-[12px]">
                <span className="strike">{cents(product.priceCents)}</span>
              </div>
              <div className="num-cell">{cents(q.winCents)}</div>
            </div>
            <div className="cell cell-acc px-4 py-4">
              <div className="tag tag-fg opacity-70">Back if {contract.label} {when}</div>
              <div className="mt-2 text-[12px] opacity-70">net {cents(q.loseCents)}</div>
              <div className="num-cell">{cents(q.rebateCents)}</div>
            </div>
            <div className="cell px-4 py-4">
              <div className="tag">Market says</div>
              <div className="mt-2 text-[12px] text-mute">{contract.label} {when}</div>
              <div className="num-cell">{Math.round(q.probability * 100)}%</div>
            </div>
            <div className="cell px-4 py-4">
              <div className="tag">Store hedge</div>
              <div className="mt-2 text-[12px] text-mute">
                {q.contractsQty} × @ {q.hedgePrice.toFixed(2)}
              </div>
              <div className="num-cell">{cents(q.hedgeCostCents)}</div>
            </div>
          </div>

          {explain && (
            <div className="border-b border-fg px-4 py-4 text-[12.5px] leading-relaxed">
              {explain.text} <span className="tag ml-1">{explain.source === "grok" ? "Grok" : "House"}</span>
            </div>
          )}
        </>
      ) : (
        <div className="border-b border-fg px-4 py-8 text-[13px] text-mute">
          {events.length === 0 ? "No open game markets right now. The list price applies." : "No clause. You pay the list price and that's the end of it."}
        </div>
      )}

      {/* Execute */}
      {!buyer && <input name="buyer" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="field border-b border-fg" />}
      <div className="grid-lines grid-cols-[1fr_auto]">
        <div className="cell px-4 py-4">
          <div className="tag">Due now</div>
          <div className="num-lg mt-1">{cents(due)}</div>
          {buyer && short > 0 && (
            <div className="mt-1 text-[11px] text-mute">
              Balance {cents(balanceCents)} · {cents(Math.ceil(short / 1000) * 1000)} added on checkout
            </div>
          )}
          {err && <div className="mt-2 text-[12px] font-bold text-acc">{err}</div>}
        </div>
        <button onClick={buy} disabled={busy !== "idle"} className="cell btn h-full w-[180px] md:w-[240px]">
          <span>{busy === "funding" ? "Funding" : busy === "paying" ? "Paying" : q ? "Buy with clause" : "Buy"}</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
