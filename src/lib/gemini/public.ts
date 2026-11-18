/**
 * Gemini Prediction Markets, public (unauthenticated) market data.
 * Base: https://api.gemini.com/v1/prediction-markets
 */
import fs from "node:fs";
import path from "node:path";
import { env } from "../env";
import { SNAPSHOT_EVENTS, SNAPSHOT_AT } from "./snapshot";
import { marketStatus as status } from "./status";

const PUBLIC_BASE = "https://api.gemini.com/v1/prediction-markets";
// Sandbox public data mirrors production for reads; we always read production prices
// so quotes reflect a real order book, and route orders to whichever env is configured.
export const geminiTradingBase =
  env.geminiEnv === "production" ? "https://api.gemini.com" : "https://api.sandbox.gemini.com";

export type GeminiPrices = {
  buy?: { yes?: string; no?: string };
  sell?: { yes?: string; no?: string };
  bestBid?: string;
  bestAsk?: string;
  lastTradePrice?: string;
};

export type GeminiContract = {
  id: string;
  label: string;
  abbreviatedName?: string;
  ticker?: string;
  instrumentSymbol: string;
  prices: GeminiPrices;
  status: string;
  marketState?: "open" | "closed";
  resolutionSide?: "yes" | "no" | null;
  resolvedAt?: string | null;
  expiryDate?: string;
  color?: string;
  imageUrl?: string;
  sportsSide?: "home" | "away";
  quantityIncrement?: string;
  quantityMinimum?: string;
  priceIncrement?: string;
};

export type GeminiEvent = {
  id: string;
  title: string;
  slug: string;
  ticker: string;
  type: "binary" | "categorical";
  category: string;
  status: "approved" | "active" | "closed" | "under_review" | "settled" | "invalid";
  resolvedAt?: string | null;
  createdAt?: string;
  expiryDate?: string;
  volume?: string;
  liquidity?: string;
  contracts: GeminiContract[];
  sportsMarket?: { sport?: string; type?: string; subject?: string };
  imageUrl?: string;
};

/* Three layers of market data, so a demo never goes blank:
   1. in-memory TTL cache (Gemini's public limit is 120/min),
   2. last-good responses persisted to disk, served stale if Gemini errors,
   3. a hand-captured snapshot of the headline market (see snapshot.ts). */
const cache = new Map<string, { at: number; value: unknown }>();
const TTL_MS = 15_000;
const DISK = path.resolve(path.dirname(env.databasePath), "gemini-cache.json");

export function marketDataStatus() {
  return { ...status };
}

let disk: Record<string, { at: number; value: unknown }> | null = null;
function loadDisk() {
  if (disk) return disk;
  try {
    disk = JSON.parse(fs.readFileSync(DISK, "utf8")) as Record<string, { at: number; value: unknown }>;
  } catch {
    disk = {};
  }
  return disk;
}
let flushTimer: NodeJS.Timeout | null = null;
function saveDisk(key: string, value: unknown) {
  const d = loadDisk();
  d[key] = { at: Date.now(), value };
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      fs.mkdirSync(path.dirname(DISK), { recursive: true });
      fs.writeFileSync(DISK, JSON.stringify(d));
    } catch {
      /* best effort */
    }
  }, 500);
}

async function get<T>(p: string, params?: Record<string, string | string[] | undefined>): Promise<T> {
  const url = new URL(PUBLIC_BASE + p);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
    else url.searchParams.set(k, v);
  }
  const key = url.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
    if (!res.ok) throw new Error(`Gemini ${res.status} on ${p}`);
    const value = (await res.json()) as T;
    cache.set(key, { at: Date.now(), value });
    saveDisk(key, value);
    status.source = "live";
    status.asOf = Date.now();
    status.lastError = undefined;
    return value;
  } catch (e) {
    status.lastError = (e as Error).message;
    const stale = loadDisk()[key];
    if (stale) {
      if (status.source === "live") {
        status.source = "cached";
        status.asOf = stale.at;
      }
      return stale.value as T;
    }
    throw e;
  }
}

function snapshotEvent(ticker: string): GeminiEvent | undefined {
  return SNAPSHOT_EVENTS.find((e) => e.ticker === ticker);
}

export async function listEvents(opts: {
  search?: string;
  category?: string;
  status?: string[];
  limit?: number;
  offset?: number;
}): Promise<{ data: GeminiEvent[]; pagination: { limit: number; offset: number; total: number } }> {
  return get("/events", {
    search: opts.search,
    category: opts.category,
    status: opts.status ?? ["active"],
    limit: String(opts.limit ?? 50),
    offset: String(opts.offset ?? 0),
  });
}

export async function getEvent(ticker: string): Promise<GeminiEvent> {
  try {
    return await get(`/events/${encodeURIComponent(ticker)}`);
  } catch (e) {
    const snap = snapshotEvent(ticker);
    if (snap) {
      status.source = "snapshot";
      status.asOf = SNAPSHOT_AT;
      return snap;
    }
    throw e;
  }
}

export async function recentlySettled(category?: string, limit = 50): Promise<GeminiEvent[]> {
  const r = await get<{ data: GeminiEvent[] }>("/events/recently-settled", {
    category,
    limit: String(limit),
  });
  return r.data;
}

/** Two-sided game markets (moneyline) are the ones a clause can attach to cleanly. */
export function isClauseable(e: GeminiEvent): boolean {
  if (e.status !== "active") return false;
  if (e.type !== "categorical" && e.type !== "binary") return false;
  const open = e.contracts.filter((c) => c.marketState !== "closed");
  if (open.length < 1 || open.length > 2) return false;
  return open.every((c) => c.prices?.buy?.yes && c.prices?.buy?.no);
}

export function askFor(c: GeminiContract, side: "yes" | "no"): number | null {
  const v = c.prices?.buy?.[side];
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Curated discovery for the storefront: Texas teams first, then the busiest game markets. */
export async function featuredEvents(): Promise<GeminiEvent[]> {
  let texas: { data: GeminiEvent[] };
  let sports: { data: GeminiEvent[] };
  try {
    [texas, sports] = await Promise.all([listEvents({ search: "Texas", limit: 40 }), listEvents({ category: "Sports", limit: 120 })]);
  } catch {
    status.source = "snapshot";
    status.asOf = SNAPSHOT_AT;
    return SNAPSHOT_EVENTS.filter(isClauseable);
  }
  const seen = new Set<string>();
  const out: GeminiEvent[] = [];
  const push = (e: GeminiEvent) => {
    if (seen.has(e.ticker) || !isClauseable(e)) return;
    seen.add(e.ticker);
    out.push(e);
  };
  // Longhorns first, then other Texas schools
  // Events where one side is literally "Texas" (the Longhorns) go first.
  texas.data.filter((e) => e.contracts.some((c) => c.label === "Texas")).forEach(push);
  texas.data.forEach(push);
  sports.data
    .sort((a, b) => Number(b.volume ?? 0) - Number(a.volume ?? 0))
    .forEach(push);
  return out.slice(0, 24);
}
