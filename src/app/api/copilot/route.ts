import { z } from "zod";
import { boot } from "@/lib/boot";
import { explain } from "@/lib/copilot";

export const dynamic = "force-dynamic";

const Body = z.object({
  productName: z.string(),
  eventTitle: z.string(),
  teamLabel: z.string(),
  rebateWhen: z.enum(["win", "lose"]),
  quote: z.object({
    baseCents: z.number(),
    loseCents: z.number(),
    winCents: z.number(),
    feeCents: z.number(),
    rebateCents: z.number(),
    hedgePrice: z.number(),
    contractsQty: z.number(),
    hedgeCostCents: z.number(),
    merchantRevenueIfRebateCents: z.number(),
    merchantRevenueIfNoRebateCents: z.number(),
    probability: z.number(),
  }),
});

export async function POST(req: Request) {
  boot();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  return Response.json(await explain(parsed.data));
}
