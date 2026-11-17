import { NextRequest } from "next/server";
import { boot } from "@/lib/boot";
import { featuredEvents, listEvents, isClauseable } from "@/lib/gemini/public";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  boot();
  const q = req.nextUrl.searchParams.get("q")?.trim();
  try {
    if (q) {
      const r = await listEvents({ search: q, limit: 40 });
      return Response.json({ events: r.data.filter(isClauseable).slice(0, 20) });
    }
    return Response.json({ events: await featuredEvents() });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
