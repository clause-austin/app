import type { GeminiEvent } from "@/lib/gemini/public";
import { openContracts, ask } from "./market";

export function OddsTicker({ events }: { events: GeminiEvent[] }) {
  const items = events
    .map((e) => {
      const [a, b] = openContracts(e);
      if (!a) return null;
      return { key: e.ticker, title: e.title, a: a.label, pa: ask(a, "yes"), b: b?.label, pb: b ? ask(b, "yes") : NaN };
    })
    .filter(Boolean) as { key: string; title: string; a: string; pa: number; b?: string; pb: number }[];
  const row = [...items, ...items];
  return (
    <div className="border-y border-line bg-ink text-cream">
      <div className="overflow-hidden py-2.5">
        <div className="marquee gap-10">
          {row.map((it, i) => (
            <div key={`${it.key}-${i}`} className="flex items-center gap-3 whitespace-nowrap text-sm">
              <span className="text-cream/60">{it.title}</span>
              <span className="scoreboard font-semibold">
                {it.a} {Math.round(it.pa * 100)}%
              </span>
              {it.b && (
                <span className="scoreboard text-cream/70">
                  {it.b} {Math.round(it.pb * 100)}%
                </span>
              )}
              <span className="h-1 w-1 rounded-full bg-orange-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
