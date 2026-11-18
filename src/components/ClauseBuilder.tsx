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
          setErr("Fill in the Buyer's name in § 1.");
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

  const fill = bounds.max > bounds.min ? ((loseCents - bounds.min) / (bounds.max - bounds.min)) * 100 : 100;
  const settles = event ? shortWhen(kickoff(event, contract)) : "";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="label">Instrument of conditional sale · draft</div>
        <div className="flex border border-line">
          {[
            ["with", true],
            ["without", false],
          ].map(([l, v]) => (
            <button
              key={String(l)}
              disabled={events.length === 0 && v === true}
              onClick={() => setEnabled(v as boolean)}
              className={`label px-3 py-1.5 transition disabled:opacity-40 ${enabled === v ? "bg-ink !text-paper" : "hover:!text-ink"}`}
            >
              {l as string} clause
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 space-y-7">
        <Article n="§ 1" title="Parties">
          This instrument is made between{" "}
          {buyer ? <span className="underline decoration-line underline-offset-4">{buyer.name}</span> : <input value={name} onChange={(e) => setName(e.target.value)} placeholder="your name" className="blank" size={Math.max(10, name.length + 2)} />}{" "}
          (&ldquo;the Buyer&rdquo;) and Clause (&ldquo;the Store&rdquo;).
        </Article>

        <Article n="§ 2" title="Goods">
          One <em>{product.name}</em>, listed at <span className="figure">{cents(product.priceCents)}</span>.
        </Article>

        {enabled && event && contract && q ? (
          <>
            <Article n="§ 3" title="Condition">
              Should{" "}
              <select value={contract.id} onChange={(e) => setContractId(e.target.value)} className="blank">
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>{" "}
              <select value={when} onChange={(e) => setWhen(e.target.value as "lose" | "win")} className="blank">
                <option value="lose">lose</option>
                <option value="win">win</option>
              </select>{" "}
              in{" "}
              <select value={event.ticker} onChange={(e) => setEventTicker(e.target.value)} className="blank max-w-full" style={{ maxWidth: "min(100%, 22ch)", textOverflow: "ellipsis" }}>
                {events.map((e) => (
                  <option key={e.ticker} value={e.ticker}>
                    {e.title} · {shortWhen(kickoff(e))}
                  </option>
                ))}
              </select>
              , settling {settles}, this instrument is <em>satisfied</em>.
              <Note>
                Gemini presently prices &ldquo;{contract.label} {when}&rdquo; at {q.hedgePrice.toFixed(2)}, an implied {Math.round(q.probability * 100)}% chance.
              </Note>
            </Article>

            <Article n="§ 4" title="Consideration">
              On execution the Buyer pays <span className="figure redline">{cents(product.priceCents)}</span> <span className="figure">{cents(q.winCents)}</span>. If satisfied, the Store returns{" "}
              <span className="figure text-red">{cents(q.rebateCents)}</span> to the Buyer, so that the Buyer will have paid <span className="figure">{cents(q.loseCents)}</span>.
              <div className="mt-5 border border-line p-4">
                <div className="flex items-baseline justify-between">
                  <span className="label">Net price if satisfied</span>
                  <span className="num text-[18px]">{cents(loseCents)}</span>
                </div>
                <input
                  type="range"
                  className="tick mt-2"
                  style={{ ["--fill" as string]: `${fill}%` }}
                  min={bounds.min}
                  max={bounds.max}
                  step={100}
                  value={loseCents}
                  onChange={(e) => setLoseCents(Number(e.target.value))}
                  aria-label="Net price if the clause is satisfied"
                />
                <div className="mono flex justify-between text-[10.5px] text-ink-3">
                  <span>{cents(bounds.min)} · bold</span>
                  <span>{cents(bounds.max)} · no clause</span>
                </div>
              </div>
            </Article>

            <Article n="§ 5" title="Hedge">
              The Store shall at once purchase <span className="figure">{q.contractsQty}</span> &ldquo;{contract.label} {when}&rdquo; contracts on Gemini at <span className="figure">{q.hedgePrice.toFixed(2)}</span>, costing{" "}
              <span className="figure">{cents(q.hedgeCostCents)}</span>. The Store&apos;s proceeds are <span className="figure">{cents(product.priceCents)}</span> plus a clause fee of{" "}
              <span className="figure">{cents(q.feeCents)}</span> in either event.
            </Article>

            <Article n="§ 6" title="Settlement">
              The consideration is held in USDC escrow on Solana and released by Gemini&apos;s resolution of the market, without further act of either party.
            </Article>
          </>
        ) : (
          <Article n="§ 3" title="Condition">
            {events.length === 0 ? "None available. No game markets are open, so the list price applies." : <>None attaches. The Buyer pays <span className="figure">{cents(product.priceCents)}</span> and the matter is closed.</>}
          </Article>
        )}
      </div>

      {explain && (
        <p className="mt-8 border-t border-line-2 pt-4 text-[12px] leading-relaxed text-ink-3">
          <sup className="sect mr-1">1</sup>
          {explain.text} <span className="label ml-1">{explain.source === "grok" ? "Grok" : "House note"}</span>
        </p>
      )}

      <div className="mt-10 border-t border-ink pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="label">Due on execution</div>
            <div className="num mt-1 text-[40px] leading-none">{cents(due)}</div>
          </div>
          <button onClick={buy} disabled={busy !== "idle"} className="btn">
            {busy === "funding" ? "Funding account" : busy === "paying" ? "Executing" : "Execute instrument"}
          </button>
        </div>
        {buyer && short > 0 && (
          <p className="mono mt-3 text-[11px] text-ink-3">
            Balance {cents(balanceCents)}. {cents(Math.ceil(short / 1000) * 1000)} will be added on execution.
          </p>
        )}
        {err && <p className="mt-3 text-[12.5px] text-red">{err}</p>}
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

function Note({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 font-sans text-[12px] leading-relaxed text-ink-3">{children}</div>;
}
