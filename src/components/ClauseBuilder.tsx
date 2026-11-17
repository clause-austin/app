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

  // reset team when the game changes
  useEffect(() => {
    if (event) setContractId(defaultContract(event)?.id ?? "");
  }, [event]);

  const q: Quote | null = enabled && contract && Number.isFinite(askPrice) ? quote(product.priceCents, loseCents, askPrice) : null;

  // Copilot explanation (debounced)
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

  // Checkout
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
          setErr("Tell us your name first.");
          return;
        }
        await signIn(name);
      }
      if (short > 0) {
        setBusy("funding");
        // round up to the next $10 so the balance looks like a card top-up, not an exact match
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

  return (
    <div className="rounded-3xl border border-line bg-paper shadow-[0_30px_80px_-40px_rgba(60,30,0,0.5)]">
      {/* Header toggle */}
      <div className="flex items-center justify-between border-b border-line px-6 py-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-ink-3">Optional</div>
          <div className="font-display text-2xl font-semibold">Add a clause</div>
        </div>
        <button
          onClick={() => setEnabled((v) => !v)}
          disabled={events.length === 0}
          aria-pressed={enabled}
          className={`relative h-8 w-14 rounded-full transition ${enabled ? "bg-orange" : "bg-line"} disabled:opacity-40`}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-paper shadow transition-all ${enabled ? "left-7" : "left-1"}`} />
        </button>
      </div>

      {enabled && event && contract ? (
        <div className="px-6 py-5">
          {/* Game */}
          <label className="block text-xs font-medium text-ink-3">The game</label>
          <select
            value={event.ticker}
            onChange={(e) => setEventTicker(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-sm outline-none focus:border-orange"
          >
            {events.map((e) => (
              <option key={e.ticker} value={e.ticker}>
                {e.title} · {shortWhen(kickoff(e))}
              </option>
            ))}
          </select>

          {/* Team + condition */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-3">The team</label>
              <div className="mt-1 grid grid-cols-2 gap-1 rounded-xl bg-cream p-1">
                {contracts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setContractId(c.id)}
                    className={`truncate rounded-lg px-2 py-2 text-sm font-medium transition ${c.id === contract.id ? "bg-ink text-cream" : "hover:bg-cream-2"}`}
                    title={c.label}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-3">I pay less if they</label>
              <div className="mt-1 grid grid-cols-2 gap-1 rounded-xl bg-cream p-1">
                {(["lose", "win"] as const).map((w) => (
                  <button key={w} onClick={() => setWhen(w)} className={`rounded-lg px-2 py-2 text-sm font-medium transition ${when === w ? "bg-ink text-cream" : "hover:bg-cream-2"}`}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Slider */}
          <div className="mt-6">
            <div className="flex items-baseline justify-between">
              <label className="text-xs font-medium text-ink-3">
                If {contract.label} {when}, I want to have paid
              </label>
              <span className="scoreboard text-2xl font-semibold text-orange">{cents(loseCents)}</span>
            </div>
            <input
              type="range"
              className="clause-range mt-3"
              style={{ ["--fill" as string]: `${fill}%` }}
              min={bounds.min}
              max={bounds.max}
              step={100}
              value={loseCents}
              onChange={(e) => setLoseCents(Number(e.target.value))}
            />
            <div className="mt-1 flex justify-between text-[11px] text-ink-3">
              <span>{cents(bounds.min)} (bold)</span>
              <span>{cents(bounds.max)} (no clause)</span>
            </div>
          </div>

          {/* The deal */}
          {q && (
            <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-line">
              <div className="bg-ink p-4 text-cream">
                <div className="text-[11px] uppercase tracking-[0.18em] text-cream/60">You pay today</div>
                <div className="scoreboard mt-1 text-4xl font-semibold">{cents(q.winCents)}</div>
                <div className="mt-1 text-xs text-cream/60">
                  that&apos;s it if {contract.label} {when === "lose" ? "win" : "lose"}
                </div>
              </div>
              <div className="bg-orange-soft/60 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-ink-3">If {contract.label} {when}</div>
                <div className="scoreboard mt-1 text-4xl font-semibold text-orange">{cents(q.rebateCents)}</div>
                <div className="mt-1 text-xs text-ink-2">comes back · you&apos;ll have paid {cents(q.loseCents)}</div>
              </div>
              <div className="col-span-2 flex items-center justify-between gap-3 border-t border-line bg-cream px-4 py-2.5 text-xs text-ink-2">
                <span>
                  Market says <span className="font-semibold text-ink">{Math.round(q.probability * 100)}%</span> chance {contract.label} {when}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-green" /> hedged on Gemini at {q.hedgePrice.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {explain && (
            <p className="mt-4 text-sm leading-relaxed text-ink-2">
              {explain.text}
              <span className="ml-2 align-middle text-[10px] uppercase tracking-widest text-ink-3">{explain.source === "grok" ? "Grok" : "Store copy"}</span>
            </p>
          )}
        </div>
      ) : (
        <div className="px-6 py-5 text-sm text-ink-3">
          {events.length === 0 ? "No open game markets right now. The sticker price applies." : "No clause: you pay the sticker price and that's the end of it."}
        </div>
      )}

      {/* Checkout */}
      <div className="border-t border-line bg-cream/60 px-6 py-5">
        {!buyer && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name for the receipt"
            className="mb-3 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-orange"
          />
        )}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-ink-3">Due now</div>
            <div className="scoreboard text-3xl font-semibold">{cents(due)}</div>
          </div>
          <button
            onClick={buy}
            disabled={busy !== "idle"}
            className="rounded-full bg-orange px-7 py-3.5 text-sm font-semibold text-cream shadow-lg shadow-orange/30 transition hover:bg-ink disabled:opacity-60"
          >
            {busy === "funding" ? "Adding funds…" : busy === "paying" ? "Placing order…" : q ? "Buy with clause" : "Buy"}
          </button>
        </div>
        {buyer && short > 0 && (
          <p className="mt-2 text-xs text-ink-3">
            Balance {cents(balanceCents)}. We&apos;ll add {cents(Math.ceil(short / 1000) * 1000)} as part of checkout.
          </p>
        )}
        {err && <p className="mt-2 text-sm text-red">{err}</p>}
      </div>
    </div>
  );
}
