/**
 * Settlement poller. Every 30s, for each event with open clauses, ask Gemini whether the
 * contract has resolved and settle if so. Runs inside the Next.js server process.
 */
import { getEvent } from "./gemini/public";
import { openEventTickers, settleEvent } from "./orders";
import { publish } from "./feed";

const g = globalThis as unknown as { __clauseResolver?: NodeJS.Timeout };

export function startResolver() {
  if (g.__clauseResolver) return;
  g.__clauseResolver = setInterval(() => {
    tick().catch((e) => console.error("[resolver]", e));
  }, 30_000);
}

export async function tick(): Promise<number> {
  let settled = 0;
  for (const { event_ticker, contract_symbol } of openEventTickers()) {
    let ev;
    try {
      ev = await getEvent(event_ticker);
    } catch (e) {
      console.warn("[resolver] fetch failed", event_ticker, (e as Error).message);
      continue;
    }
    const c = ev.contracts.find((x) => x.instrumentSymbol === contract_symbol);
    if (!c) continue;
    const side = c.resolutionSide;
    if ((ev.status === "settled" || c.status === "settled") && (side === "yes" || side === "no")) {
      publish({
        kind: "resolution",
        source: "gemini",
        title: `${ev.title} resolved`,
        detail: `${c.label}: ${side.toUpperCase()}`,
        order_id: null,
        href: `https://www.gemini.com/prediction-markets/event/${encodeURIComponent(ev.ticker)}`,
      });
      const rows = await settleEvent({ eventTicker: ev.ticker, contractSymbol: c.instrumentSymbol, resolutionSide: side, source: "gemini" });
      settled += rows.length;
    }
  }
  return settled;
}
