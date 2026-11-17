/** Called from every API route: idempotently seeds data and starts background workers. */
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
}
