/**
 * ElevenLabs text-to-speech for settlement announcements. Audio is cached per order on disk.
 * Without a key the API returns 204 and the client falls back to the browser's speech synthesis.
 */
import fs from "node:fs";
import path from "node:path";
import { env } from "./env";
import { cents } from "./pricing";
import type { OrderRow } from "./db";

export function settlementScript(o: OrderRow, buyerName: string, productName: string): string {
  if (!o.event_title) return `Thanks ${buyerName}. Your ${productName} is on its way.`;
  const team = o.contract_label ?? "your team";
  const outcomeWord = o.rebate_side === "no" ? "lost" : "won";
  if (o.outcome === "rebate") {
    return `${buyerName}, ${team} ${outcomeWord}. Your clause just triggered. ${cents(o.paid_cents - (o.lose_cents ?? 0))} is back in your account, so that ${productName} cost you ${cents(o.lose_cents ?? 0)}.`;
  }
  return `${buyerName}, ${team} ${outcomeWord === "lost" ? "won" : "lost"}, so your clause didn't trigger. You paid ${cents(o.paid_cents)} for the ${productName}. Enjoy it.`;
}

export function hasElevenLabs(): boolean {
  return Boolean(env.elevenLabsApiKey);
}

export async function synthesize(orderId: string, text: string): Promise<Buffer | null> {
  if (!hasElevenLabs()) return null;
  const dir = path.resolve(process.cwd(), "data", "voice");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${orderId}.mp3`);
  if (fs.existsSync(file)) return fs.readFileSync(file);

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${env.elevenLabsVoiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": env.elevenLabsApiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_turbo_v2_5", voice_settings: { stability: 0.4, similarity_boost: 0.8 } }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, buf);
  return buf;
}
