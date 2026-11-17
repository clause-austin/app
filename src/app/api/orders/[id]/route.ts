import { boot } from "@/lib/boot";
import { getOrder, hedgeForOrder, getBuyer } from "@/lib/orders";
import { db, type ProductRow } from "@/lib/db";
import { recentFeed } from "@/lib/feed";
import { settlementScript, hasElevenLabs } from "@/lib/voice";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  boot();
  const { id } = await ctx.params;
  const o = getOrder(id);
  if (!o) return Response.json({ error: "not found" }, { status: 404 });
  const product = db().prepare(`SELECT * FROM products WHERE id=?`).get(o.product_id) as ProductRow;
  const buyer = getBuyer(o.buyer_id)!;
  return Response.json({
    order: o,
    product,
    buyer: { name: buyer.name, pubkey: buyer.pubkey },
    hedge: hedgeForOrder(o.id) ?? null,
    feed: recentFeed(30, o.id),
    voice: {
      script: o.settled_at ? settlementScript(o, buyer.name, product.name) : null,
      elevenlabs: hasElevenLabs(),
    },
  });
}
