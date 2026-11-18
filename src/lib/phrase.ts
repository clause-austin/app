/**
 * Wording for a clause condition. Sports contracts read "Texas lose / Texas lost";
 * crypto windows (sandbox tickers, prefixed "sbx:") read "Bitcoin is down / Bitcoin was down".
 * Import-free so client components can use it.
 */
export const SANDBOX_PREFIX = "sbx:";

export function isCryptoTicker(ticker: string | null | undefined): boolean {
  return Boolean(ticker && ticker.startsWith(SANDBOX_PREFIX));
}

/** The two selectable conditions for a contract, in rebate-side order [no, yes]. */
export function conditionWords(ticker: string | null | undefined): { no: string; yes: string } {
  return isCryptoTicker(ticker) ? { no: "is down", yes: "is up" } : { no: "lose", yes: "win" };
}

/** "Texas lose" · "Bitcoin is down" · past tense "Texas lost" · "Bitcoin was down". */
export function condition(label: string | null | undefined, ticker: string | null | undefined, side: "yes" | "no", tense: "present" | "past" = "present"): string {
  const l = label ?? (isCryptoTicker(ticker) ? "the price" : "your team");
  if (isCryptoTicker(ticker)) return `${l} ${tense === "past" ? "was" : "is"} ${side === "no" ? "down" : "up"}`;
  if (tense === "past") return `${l} ${side === "no" ? "lost" : "won"}`;
  return `${l} ${side === "no" ? "lose" : "win"}`;
}

/** Public page for an event on the venue it trades on. */
export function eventUrl(ticker: string): string {
  if (isCryptoTicker(ticker)) return `https://exchange.sandbox.gemini.com/prediction-markets/event/${encodeURIComponent(ticker.slice(SANDBOX_PREFIX.length))}`;
  return `https://www.gemini.com/prediction-markets/event/${encodeURIComponent(ticker)}`;
}
