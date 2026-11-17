/**
 * Live activity feed: persisted to SQLite and fanned out to SSE subscribers.
 * Sources: Solana transfers (via QuickNode Streams webhook or RPC poller), Gemini hedges,
 * settlements, ElevenLabs announcements.
 */
import { db, type FeedRow } from "./db";

type Listener = (row: FeedRow) => void;
const g = globalThis as unknown as { __clauseListeners?: Set<Listener> };
function listeners(): Set<Listener> {
  if (!g.__clauseListeners) g.__clauseListeners = new Set();
  return g.__clauseListeners;
}

export function publish(ev: Omit<FeedRow, "id" | "created_at">): FeedRow {
  const created_at = Date.now();
  const info = db()
    .prepare(
      `INSERT INTO feed (kind, title, detail, order_id, href, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(ev.kind, ev.title, ev.detail ?? null, ev.order_id ?? null, ev.href ?? null, ev.source, created_at);
  const row: FeedRow = { id: Number(info.lastInsertRowid), created_at, ...ev, detail: ev.detail ?? null, order_id: ev.order_id ?? null, href: ev.href ?? null };
  for (const l of listeners()) {
    try {
      l(row);
    } catch {
      /* subscriber gone */
    }
  }
  return row;
}

export function subscribe(l: Listener): () => void {
  listeners().add(l);
  return () => listeners().delete(l);
}

export function recentFeed(limit = 60, orderId?: string): FeedRow[] {
  if (orderId) {
    return db()
      .prepare(`SELECT * FROM feed WHERE order_id = ? ORDER BY id DESC LIMIT ?`)
      .all(orderId, limit) as FeedRow[];
  }
  return db().prepare(`SELECT * FROM feed ORDER BY id DESC LIMIT ?`).all(limit) as FeedRow[];
}
