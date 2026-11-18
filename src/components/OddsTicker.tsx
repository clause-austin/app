import type { GeminiEvent } from "@/lib/gemini/public";
import { openContracts, ask } from "./market";

export function OddsTicker({ events }: { events: GeminiEvent[] }) {
  const items = events
    .map((e) => {
      const [a, b] = openContracts(e);
      if (!a) return null;
      return { key: e.ticker, a: a.label, pa: ask(a, "yes"), b: b?.label, pb: b ? ask(b, "yes") : NaN };
    })
    .filter(Boolean) as { key: string; a: string; pa: number; b?: string; pb: number }[];
  const row = [...items, ...items];
  return (
    <div className="border-y border-line">
      <div className="mx-auto flex max-w-6xl items-stretch">
        <div className="label flex shrink-0 items-center gap-2 border-r border-line py-2 pr-4 pl-4 md:pl-6">
          <span className="live inline-block h-1.5 w-1.5 bg-red" /> Gemini
        </div>
        <div className="overflow-hidden py-2">
          <div className="marquee gap-8 pl-6">
            {row.map((it, i) => (
              <div key={`${it.key}-${i}`} className="mono flex items-center gap-2 whitespace-nowrap text-[11.5px]">
                <span>{it.a}</span>
                <span className="text-ink-3">{it.pa.toFixed(2)}</span>
                {it.b && (
                  <>
                    <span className="text-line">/</span>
                    <span>{it.b}</span>
                    <span className="text-ink-3">{it.pb.toFixed(2)}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
