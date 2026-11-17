import { z } from "zod";
import { boot } from "@/lib/boot";
import { getEvent, askFor } from "@/lib/gemini/public";
import { quote, loseBounds } from "@/lib/pricing";
import { getProduct } from "@/lib/orders";

export const dynamic = "force-dynamic";

const Body = z.object({
  productSlug: z.string(),
  eventTicker: z.string(),
  contractSymbol: z.string(),
  rebateSide: z.enum(["yes", "no"]),
  loseCents: z.number().int().optional(),
});

export async function POST(req: Request) {
  boot();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;
  const product = getProduct(b.productSlug);
  if (!product) return Response.json({ error: "no such product" }, { status: 404 });
  const ev = await getEvent(b.eventTicker);
  const c = ev.contracts.find((x) => x.instrumentSymbol === b.contractSymbol);
  if (!c) return Response.json({ error: "no such contract" }, { status: 404 });
  const ask = askFor(c, b.rebateSide);
  if (ask === null) return Response.json({ error: "no live price" }, { status: 409 });
  const bounds = loseBounds(product.price_cents, ask);
  const lose = b.loseCents ?? Math.round(product.price_cents * 0.5);
  return Response.json({
    quote: quote(product.price_cents, lose, ask),
    bounds,
    market: { status: ev.status, title: ev.title, contractLabel: c.label, ask, expiry: c.expiryDate ?? ev.expiryDate },
  });
}
