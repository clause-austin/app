import { boot } from "@/lib/boot";
import { allOrders, allHedges, getBuyer } from "@/lib/orders";
import { db, type ProductRow } from "@/lib/db";
import { recentFeed } from "@/lib/feed";
import { integrationStatus } from "@/lib/env";
import { keysReady, loadKeypair, usdcBalanceCents, solBalance, explorerAddress } from "@/lib/solana";

export const dynamic = "force-dynamic";

export async function GET() {
  boot();
  const orders = allOrders();
  const hedges = allHedges();
  const byOrder = new Map(hedges.map((h) => [h.order_id, h]));
  const products = new Map((db().prepare(`SELECT * FROM products`).all() as ProductRow[]).map((p) => [p.id, p]));

  // Merchant P&L: realised on settled orders; locked-in (either-way) on open ones.
  let realised = 0;
  let baseline = 0;
  let openLocked = 0;
  let hedgeCost = 0;
  let hedgePayout = 0;
  let rebatedToFans = 0;
  for (const o of orders) {
    const h = byOrder.get(o.id);
    if (o.status === "settled" || o.status === "rebated") {
      // House listings: the store keeps what escrow holds. Seller listings: the seller takes list price,
      // the house books only the fee + hedge recovery (and the hedge payout covers the seller's top-up).
      const merchantIn = o.seller_id
        ? o.outcome === "rebate" ? -(o.base_cents - o.lose_cents!) : o.paid_cents - o.base_cents
        : o.outcome === "rebate" ? o.lose_cents! : o.paid_cents;
      const payout = h?.payout_cents ?? 0;
      const cost = h?.cost_cents ?? 0;
      realised += merchantIn + payout - cost;
      baseline += o.seller_id ? o.fee_cents : o.base_cents;
      hedgeCost += cost;
      hedgePayout += payout;
      if (o.outcome === "rebate") rebatedToFans += o.paid_cents - o.lose_cents!;
    } else if (o.event_ticker) {
      const cost = h?.cost_cents ?? 0;
      // either-way revenue = L + N - cost = W - cost (identical by construction)
      openLocked += o.seller_id ? o.fee_cents : o.paid_cents - cost;
      hedgeCost += cost;
    }
  }

  let wallets: unknown = null;
  if (keysReady()) {
    try {
      const esc = loadKeypair("escrow").publicKey;
      const mer = loadKeypair("merchant").publicKey;
      const tre = loadKeypair("treasury").publicKey;
      const [e, m, t, ts] = await Promise.all([usdcBalanceCents(esc), usdcBalanceCents(mer), usdcBalanceCents(tre), solBalance(tre)]);
      wallets = {
        escrow: { address: esc.toBase58(), usdcCents: e, href: explorerAddress(esc.toBase58()) },
        merchant: { address: mer.toBase58(), usdcCents: m, href: explorerAddress(mer.toBase58()) },
        treasury: { address: tre.toBase58(), usdcCents: t, sol: ts, href: explorerAddress(tre.toBase58()) },
      };
    } catch {
      wallets = null;
    }
  }

  return Response.json({
    integrations: integrationStatus(),
    wallets,
    pnl: { realised, baseline, openLocked, hedgeCost, hedgePayout, rebatedToFans, orders: orders.length, clauses: orders.filter((o) => o.event_ticker).length },
    orders: orders.map((o) => ({
      ...o,
      buyer: getBuyer(o.buyer_id)?.name ?? "?",
      seller: o.seller_id ? (getBuyer(o.seller_id)?.name ?? "?") : null,
      product: products.get(o.product_id)?.name ?? "?",
      hedge: byOrder.get(o.id) ?? null,
    })),
    feed: recentFeed(60),
  });
}
