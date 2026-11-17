import { boot } from "@/lib/boot";
import { getOrder, getBuyer } from "@/lib/orders";
import { db, type ProductRow } from "@/lib/db";
import { settlementScript, synthesize } from "@/lib/voice";
import { publish } from "@/lib/feed";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  boot();
  const { id } = await ctx.params;
  const o = getOrder(id);
  if (!o || !o.settled_at) return new Response(null, { status: 404 });
  const product = db().prepare(`SELECT * FROM products WHERE id=?`).get(o.product_id) as ProductRow;
  const buyer = getBuyer(o.buyer_id)!;
  const text = settlementScript(o, buyer.name, product.name);
  try {
    const audio = await synthesize(o.id, text);
    if (!audio) return new Response(null, { status: 204, headers: { "x-voice-script": encodeURIComponent(text) } });
    publish({ kind: "voice", source: "elevenlabs", title: "Settlement announced by voice", detail: text, order_id: o.id, href: null });
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    return new Response(null, { status: 204, headers: { "x-voice-script": encodeURIComponent(text), "x-voice-error": (e as Error).message } });
  }
}
