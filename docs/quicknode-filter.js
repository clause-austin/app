// QuickNode Streams filter — Solana devnet, dataset "block".
// Keeps only transactions that touch the Clause escrow wallet and returns them in the
// shape /api/webhooks/quicknode already understands ({transaction:{signatures}, meta:{logMessages}, slot}).
const ESCROW = "8MPShtxFArpofKJercHnYSfP3o1Xb8MSSbrguAyMqDTE";

function main(stream) {
  const blocks = Array.isArray(stream.data) ? stream.data : [stream.data];
  const out = [];
  for (const block of blocks) {
    if (!block || !Array.isArray(block.transactions)) continue;
    for (const tx of block.transactions) {
      const keys = (tx.transaction?.message?.accountKeys ?? []).map((k) => (typeof k === "string" ? k : k.pubkey));
      const loaded = tx.meta?.loadedAddresses ?? {};
      const all = keys.concat(loaded.writable ?? [], loaded.readonly ?? []);
      if (!all.includes(ESCROW)) continue;
      out.push({
        slot: block.parentSlot != null ? block.parentSlot + 1 : block.slot,
        transaction: { signatures: tx.transaction.signatures },
        meta: { logMessages: tx.meta?.logMessages ?? [], err: tx.meta?.err ?? null },
      });
    }
  }
  // Returning null tells QuickNode to drop the batch (nothing is delivered to the webhook).
  return out.length ? { matched: out } : null;
}
