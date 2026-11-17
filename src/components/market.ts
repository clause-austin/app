/** Client-safe helpers over Gemini event JSON. */
import type { GeminiEvent, GeminiContract } from "@/lib/gemini/public";

export type { GeminiEvent, GeminiContract };

export function openContracts(e: GeminiEvent): GeminiContract[] {
  return e.contracts.filter((c) => c.marketState !== "closed" && c.prices?.buy?.yes);
}

export function ask(c: GeminiContract, side: "yes" | "no"): number {
  return Number(c.prices?.buy?.[side] ?? NaN);
}

export function kickoff(e: GeminiEvent, c?: GeminiContract): Date | null {
  const iso = c?.expiryDate ?? e.expiryDate;
  return iso ? new Date(iso) : null;
}

export function shortWhen(d: Date | null): string {
  if (!d) return "TBD";
  return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Default team for a clause: the Longhorns if present, otherwise the favourite. */
export function defaultContract(e: GeminiEvent): GeminiContract | undefined {
  const open = openContracts(e);
  return open.find((c) => c.label === "Texas") ?? open.sort((a, b) => ask(b, "yes") - ask(a, "yes"))[0];
}
