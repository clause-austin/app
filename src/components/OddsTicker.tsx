import type { GeminiEvent } from "@/lib/gemini/public";
import { openContracts, ask } from "./market";

export function OddsTicker({ events, source }: { events: GeminiEvent[]; source: string }) {
  const items = events
    .map((e) => {
      const [a, b] = openContracts(e);
      if (!a) return null;
      return { key: e.ticker, a: a.label, pa: ask(a, "yes"), b: b?.label, pb: b ? ask(b, "yes") : NaN };
    })
    .filter(Boolean) as { key: string; a: string; pa: number; b?: string; pb: number }[];
  const row = items.length < 6 ? [...items, ...items, ...items, ...items] : [...items, ...items];
  return (
    <div className="grid-lines grid-cols-[auto_1fr] border-y border-fg">
      <div className="cell flex items-center gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em]">
        <span className={`inline-block h-2 w-2 ${source === "live" ? "live bg-acc" : "bg-mute"}`} />
        Gemini {source === "live" ? "live" : source}
      </div>
      <div className="cell overflow-hidden py-2">
        <div className="marquee gap-10 pl-6 text-[12px]">
          {row.map((it, i) => (
            <span key={`${it.key}-${i}`} className="whitespace-nowrap">
              <b>{it.a.toUpperCase()}</b> {it.pa.toFixed(2)}
              {it.b && (
                <>
                  <span className="mx-2 text-mute">/</span>
                  <b>{it.b.toUpperCase()}</b> {it.pb.toFixed(2)}
                </>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
