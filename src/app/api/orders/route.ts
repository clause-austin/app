import { z } from "zod";
import { boot } from "@/lib/boot";
import { currentBuyer } from "@/lib/session";
import { checkout, getProduct, ordersForBuyer, hedgeForOrder } from "@/lib/orders";
import { db, type ProductRow } from "@/lib/db";

export const dynamic = "force-dynamic";

const Body = z.object({
  productSlug: z.string(),
  clause: z
    .object({
      eventTicker: z.string(),
      contractSymbol: z.string(),
      rebateSide: z.enum(["yes", "no"]),
      loseCents: z.number().int(),
    })
    .optional(),
});

export async function POST(req: Request) {
  boot();
  const buyer = await currentBuyer();
  if (!buyer) return Response.json({ error: "no session" }, { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const product = getProduct(parsed.data.productSlug);
  if (!product) return Response.json({ error: "no such product" }, { status: 404 });
  try {
    const order = await checkout({ buyer, product, clause: parsed.data.clause });
    return Response.json({ order });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function GET() {
  boot();
  const buyer = await currentBuyer();
  if (!buyer) return Response.json({ orders: [] });
  const orders = ordersForBuyer(buyer.id).map((o) => ({
    ...o,
    product: db().prepare(`SELECT * FROM products WHERE id=?`).get(o.product_id) as ProductRow,
    hedge: hedgeForOrder(o.id) ?? null,
  }));
  return Response.json({ orders });
}
