/**
 * Gemini Prediction Markets, authenticated trading.
 * Classic Gemini signing: payload JSON -> base64 -> X-GEMINI-PAYLOAD, HMAC-SHA384 hex -> X-GEMINI-SIGNATURE.
 * The spec shows prediction-market endpoints accepting JSON bodies as well; we send both forms
 * (header payload + JSON body with identical content), which satisfies either reading of the docs.
 */
import crypto from "node:crypto";
import { env } from "../env";
import { geminiTradingBase } from "./public";

export function geminiTradingEnabled(): boolean {
  return Boolean(env.geminiApiKey && env.geminiApiSecret);
}

let lastNonce = 0;
function nonce(): number {
  const n = Math.max(Date.now(), lastNonce + 1);
  lastNonce = n;
  return n;
}

async function signedPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const payload = { request: path, nonce: nonce(), ...body };
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  const sig = crypto.createHmac("sha384", env.geminiApiSecret).update(b64).digest("hex");
  const res = await fetch(geminiTradingBase + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GEMINI-APIKEY": env.geminiApiKey,
      "X-GEMINI-PAYLOAD": b64,
      "X-GEMINI-SIGNATURE": sig,
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Gemini ${res.status} ${path}: ${text.slice(0, 300)}`);
  }
  return json as T;
}

async function signedGet<T>(path: string): Promise<T> {
  const payload = { request: path, nonce: nonce() };
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  const sig = crypto.createHmac("sha384", env.geminiApiSecret).update(b64).digest("hex");
  const res = await fetch(geminiTradingBase + path, {
    headers: {
      "X-GEMINI-APIKEY": env.geminiApiKey,
      "X-GEMINI-PAYLOAD": b64,
      "X-GEMINI-SIGNATURE": sig,
      "Cache-Control": "no-cache",
    },
  });
  if (!res.ok) throw new Error(`Gemini ${res.status} ${path}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

export type GeminiOrderResponse = {
  orderId: number | string;
  status: "open" | "filled" | "cancelled";
  symbol: string;
  side: "buy" | "sell";
  outcome: "yes" | "no";
  quantity: string;
  filledQuantity?: string;
  remainingQuantity?: string;
  price: string;
  avgExecutionPrice?: string;
};

/** Accept the prediction-markets terms once per account; required before the first order. */
export async function ensureTermsAccepted(): Promise<void> {
  try {
    const status = await signedGet<{ hasAcceptedLatest?: boolean }>("/v1/prediction-markets/terms/status");
    if (status.hasAcceptedLatest) return;
    await signedPost("/v1/prediction-markets/terms/accept", {});
  } catch (e) {
    // Non-fatal: the order call reports TermsNotAccepted explicitly if this really failed.
    console.warn("[gemini] terms check skipped:", (e as Error).message);
  }
}

export async function placeHedgeOrder(opts: {
  symbol: string;
  outcome: "yes" | "no";
  quantity: number;
  limitPrice: number;
}): Promise<GeminiOrderResponse> {
  await ensureTermsAccepted();
  return signedPost<GeminiOrderResponse>("/v1/prediction-markets/order", {
    symbol: opts.symbol,
    orderType: "limit",
    side: "buy",
    outcome: opts.outcome,
    quantity: opts.quantity.toFixed(2),
    price: opts.limitPrice.toFixed(2),
    timeInForce: "immediate-or-cancel",
  });
}

export async function positions(eventTicker?: string): Promise<unknown> {
  return signedPost("/v1/prediction-markets/positions", eventTicker ? { eventTicker } : {});
}
