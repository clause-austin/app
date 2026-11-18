/** Called from every API route: idempotently seeds data and starts background workers. */
import { hedge } from "./orders";
import { db, type OrderRow } from "./db";
import { ensureSeeded } from "./products";
import { startResolver } from "./resolver";
import { startEscrowPoller } from "./quicknode";

const g = globalThis as unknown as { __clauseBooted?: boolean };

export function boot() {
  if (g.__clauseBooted) return;
  g.__clauseBooted = true;
  ensureSeeded();
  startResolver();
  startEscrowPoller();
  rehedgeStranded();
}

/** Clause orders that paid but never got a hedge row (e.g. the venue threw mid-flight) get hedged on boot. */
function rehedgeStranded() {
  const rows = db()
    .prepare(`SELECT o.* FROM orders o LEFT JOIN hedges h ON h.order_id=o.id WHERE o.status='paid' AND o.event_ticker IS NOT NULL AND h.id IS NULL`)
    .all() as OrderRow[];
  for (const row of rows) {
    hedge(row).catch((e) => console.error("[boot] rehedge failed", row.id, e));
  }
}
