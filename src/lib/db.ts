import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { env } from "./env";

/* Single process-wide SQLite handle. Next.js hot reload re-evaluates modules,
   so the instance is parked on globalThis to avoid leaking file handles. */
const g = globalThis as unknown as { __clauseDb?: Database.Database };

export function db(): Database.Database {
  if (g.__clauseDb) return g.__clauseDb;
  fs.mkdirSync(path.dirname(env.databasePath), { recursive: true });
  const d = new Database(env.databasePath);
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
  migrate(d);
  g.__clauseDb = d;
  return d;
}

function migrate(d: Database.Database) {
  d.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    tagline TEXT NOT NULL,
    description TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    image TEXT NOT NULL,
    accent TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS buyers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pubkey TEXT NOT NULL,
    secret TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    buyer_id TEXT NOT NULL REFERENCES buyers(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    base_cents INTEGER NOT NULL,
    -- clause
    event_ticker TEXT,
    event_title TEXT,
    contract_symbol TEXT,
    contract_label TEXT,
    rebate_side TEXT,            -- 'yes' | 'no': rebate pays when contract resolves to this side
    hedge_price TEXT,            -- ask price paid per contract on rebate_side at sale time
    win_cents INTEGER,           -- price if rebate does NOT trigger (what buyer pays up front)
    lose_cents INTEGER,          -- price if rebate triggers
    fee_cents INTEGER NOT NULL DEFAULT 0,
    contracts_qty TEXT,          -- number of contracts hedged (string decimal)
    expiry_at INTEGER,
    -- money movement
    paid_cents INTEGER NOT NULL,
    pay_tx TEXT,
    settle_tx TEXT,
    rebate_tx TEXT,
    status TEXT NOT NULL,        -- paid | hedged | settled | rebated | failed
    outcome TEXT,                -- 'rebate' | 'no_rebate' | null
    created_at INTEGER NOT NULL,
    settled_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS hedges (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    venue TEXT NOT NULL,          -- 'gemini:sandbox' | 'gemini:production' | 'paper'
    symbol TEXT NOT NULL,
    outcome TEXT NOT NULL,        -- yes | no
    side TEXT NOT NULL,           -- buy
    quantity TEXT NOT NULL,
    price TEXT NOT NULL,
    cost_cents INTEGER NOT NULL,
    gemini_order_id TEXT,
    status TEXT NOT NULL,         -- open | filled | settled | error
    payout_cents INTEGER,
    raw TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feed (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT,
    order_id TEXT,
    href TEXT,
    source TEXT NOT NULL,          -- solana | gemini | quicknode | system | elevenlabs
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS seen_signatures (
    signature TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settlements (
    event_ticker TEXT PRIMARY KEY,
    contract_symbol TEXT NOT NULL,
    resolution_side TEXT NOT NULL,
    source TEXT NOT NULL,          -- gemini | demo
    created_at INTEGER NOT NULL
  );
  `);
}

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  price_cents: number;
  image: string;
  accent: string;
  sort: number;
};

export type BuyerRow = {
  id: string;
  name: string;
  pubkey: string;
  secret: string;
  created_at: number;
};

export type OrderRow = {
  id: string;
  buyer_id: string;
  product_id: string;
  base_cents: number;
  event_ticker: string | null;
  event_title: string | null;
  contract_symbol: string | null;
  contract_label: string | null;
  rebate_side: "yes" | "no" | null;
  hedge_price: string | null;
  win_cents: number | null;
  lose_cents: number | null;
  fee_cents: number;
  contracts_qty: string | null;
  expiry_at: number | null;
  paid_cents: number;
  pay_tx: string | null;
  settle_tx: string | null;
  rebate_tx: string | null;
  status: "paid" | "hedged" | "settled" | "rebated" | "failed";
  outcome: "rebate" | "no_rebate" | null;
  created_at: number;
  settled_at: number | null;
};

export type HedgeRow = {
  id: string;
  order_id: string;
  venue: string;
  symbol: string;
  outcome: "yes" | "no";
  side: "buy";
  quantity: string;
  price: string;
  cost_cents: number;
  gemini_order_id: string | null;
  status: "open" | "filled" | "settled" | "error";
  payout_cents: number | null;
  raw: string | null;
  created_at: number;
};

export type FeedRow = {
  id: number;
  kind: string;
  title: string;
  detail: string | null;
  order_id: string | null;
  href: string | null;
  source: "solana" | "gemini" | "quicknode" | "system" | "elevenlabs";
  created_at: number;
};

export function newId(prefix: string): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${prefix}_${s}`;
}
