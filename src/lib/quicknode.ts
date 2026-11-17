/**
 * Escrow wallet observer.
 *
 * Preferred: a QuickNode Streams webhook (Solana devnet, filtered to the escrow address) posts
 * matched transactions to /api/webhooks/quicknode. Signature check follows QuickNode's scheme:
 *   HMAC-SHA256(nonce + timestamp + rawBody, securityToken) == x-qn-signature
 *
 * Fallback: an in-process poller that reads the escrow's recent signatures over RPC and emits the
 * same feed events, so the dashboard behaves identically without a stream configured.
 */
import crypto from "node:crypto";
import { env } from "./env";
import { db } from "./db";
import { publish } from "./feed";
import { connection, loadKeypair, keysReady, explorerTx } from "./solana";

export function verifyQuickNodeSignature(headers: Headers, rawBody: string): boolean {
  const token = env.quickNodeWebhookToken;
  if (!token) return false;
  const nonce = headers.get("x-qn-nonce") ?? "";
  const ts = headers.get("x-qn-timestamp") ?? "";
  const sig = headers.get("x-qn-signature") ?? "";
  const expected = crypto.createHmac("sha256", token).update(nonce + ts + rawBody).digest("hex");
  return sig.length > 0 && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig.padEnd(expected.length).slice(0, expected.length)));
}

function markSeen(signature: string): boolean {
  const r = db()
    .prepare(`INSERT OR IGNORE INTO seen_signatures (signature, created_at) VALUES (?, ?)`)
    .run(signature, Date.now());
  return r.changes > 0;
}

/** Normalize a QuickNode Streams Solana payload (block or filtered tx list) into signatures + memos. */
export function ingestStreamPayload(payload: unknown, source: "quicknode" | "solana"): number {
  const txs: { signature: string; memo?: string; slot?: number }[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const o = node as Record<string, unknown>;
    const sigs = (o.transaction as { signatures?: string[] } | undefined)?.signatures ?? (o.signatures as string[] | undefined);
    const sig = Array.isArray(sigs) ? sigs[0] : typeof o.signature === "string" ? o.signature : undefined;
    if (sig) {
      const logs = ((o.meta as { logMessages?: string[] } | undefined)?.logMessages ?? []) as string[];
      const memoLog = logs.find((l) => l.includes("Program log: Memo"));
      const memo = memoLog?.match(/"([^"]+)"/)?.[1];
      txs.push({ signature: sig, memo, slot: typeof o.slot === "number" ? o.slot : undefined });
      return;
    }
    Object.values(o).forEach(walk);
  };
  walk(payload);

  let n = 0;
  for (const t of txs) {
    if (!markSeen(t.signature)) continue;
    n++;
    const parts = t.memo?.split(":") ?? [];
    const orderId = parts[0] === "clause" ? parts[1] : null;
    publish({
      kind: "chain",
      source,
      title: source === "quicknode" ? "QuickNode Stream: escrow transaction confirmed" : "Escrow transaction confirmed",
      detail: t.memo ? `memo ${t.memo}${t.slot ? ` · slot ${t.slot}` : ""}` : t.signature.slice(0, 20) + "…",
      order_id: orderId,
      href: explorerTx(t.signature),
    });
  }
  return n;
}

const g = globalThis as unknown as { __clausePoller?: NodeJS.Timeout };

export function startEscrowPoller() {
  if (g.__clausePoller || env.quickNodeWebhookToken || !keysReady()) return;
  const escrow = loadKeypair("escrow").publicKey;
  // Seed seen-set so we don't replay history as "live" on boot
  connection()
    .getSignaturesForAddress(escrow, { limit: 50 })
    .then((sigs) => sigs.forEach((s) => markSeen(s.signature)))
    .catch(() => {});
  g.__clausePoller = setInterval(async () => {
    try {
      const sigs = await connection().getSignaturesForAddress(escrow, { limit: 10 });
      const fresh = sigs.filter((s) => !db().prepare(`SELECT 1 FROM seen_signatures WHERE signature=?`).get(s.signature));
      if (fresh.length === 0) return;
      const txs = await connection().getParsedTransactions(
        fresh.map((s) => s.signature),
        { maxSupportedTransactionVersion: 0 },
      );
      ingestStreamPayload(
        txs.filter(Boolean).map((t, i) => ({ signature: fresh[i].signature, slot: t!.slot, meta: t!.meta })),
        "solana",
      );
    } catch (e) {
      console.warn("[poller]", (e as Error).message);
    }
  }, 8_000);
}
