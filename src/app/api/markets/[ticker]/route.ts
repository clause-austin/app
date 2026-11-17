import { boot } from "@/lib/boot";
import { getEvent } from "@/lib/gemini/public";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ ticker: string }> }) {
  boot();
  const { ticker } = await ctx.params;
  try {
    return Response.json({ event: await getEvent(ticker) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
