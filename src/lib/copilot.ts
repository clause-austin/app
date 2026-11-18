/**
 * One-line, plain-English explanation of a clause at checkout.
 * Uses xAI Grok (OpenAI-compatible chat completions) when configured; otherwise templated copy.
 */
import { env } from "./env";
import { cents, pct, type Quote } from "./pricing";

export type CopilotInput = {
  productName: string;
  eventTitle: string;
  teamLabel: string;
  rebateWhen: string; // "lose" | "win" | "is down" | "is up"
  quote: Quote;
};

export function templateExplanation(i: CopilotInput): string {
  const chance = pct(i.quote.probability);
  return `You pay ${cents(i.quote.winCents)} today. If ${i.teamLabel} ${i.rebateWhen}, ${cents(i.quote.rebateCents)} comes straight back and the ${i.productName} cost you ${cents(i.quote.loseCents)}. The market puts that at about a ${chance} chance right now, and the store has already hedged it, so nobody is sweating the result except you.`;
}

export async function explain(i: CopilotInput): Promise<{ text: string; source: "grok" | "template" }> {
  if (!env.xaiApiKey) return { text: templateExplanation(i), source: "template" };
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.xaiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-4-fast",
        temperature: 0.7,
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content:
              "You write one or two punchy sentences for a sports fan at checkout. Plain English, no jargon, no crypto words, no exclamation marks. Never mention probabilities as decimals; use percentages.",
          },
          {
            role: "user",
            content: `Product: ${i.productName}. Market: ${i.eventTitle}. The fan pays ${cents(i.quote.winCents)} now. If ${i.teamLabel} ${i.rebateWhen}, they get ${cents(i.quote.rebateCents)} back (final price ${cents(i.quote.loseCents)}). Market-implied chance of that: ${pct(i.quote.probability)}. Explain the deal to them.`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`xAI ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("empty");
    return { text, source: "grok" };
  } catch (e) {
    console.warn("[copilot] falling back:", (e as Error).message);
    return { text: templateExplanation(i), source: "template" };
  }
}
