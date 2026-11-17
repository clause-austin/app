/**
 * Demo control: settle an event now with a chosen result (what Gemini will do for real when
 * the game ends). Also exposes `tick` to force a poll of real Gemini settlements.
 */
import { z } from "zod";
import { boot } from "@/lib/boot";
import { env } from "@/lib/env";
import { settleEvent, openEventTickers } from "@/lib/orders";
import { tick } from "@/lib/resolver";
import { publish } from "@/lib/feed";

export const dynamic = "force-dynamic";

const Body = z.union([
  z.object({ action: z.literal("tick") }),
  z.object({
    action: z.literal("resolve"),
    eventTicker: z.string(),
    contractSymbol: z.string(),
    resolutionSide: z.enum(["yes", "no"]),
  }),
]);

export async function POST(req: Request) {
  boot();
  if (req.headers.get("x-admin-token") !== env.adminToken) return Response.json({ error: "forbidden" }, { status: 403 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  try {
    if (parsed.data.action === "tick") {
      const n = await tick();
      return Response.json({ settled: n });
    }
    const { eventTicker, contractSymbol, resolutionSide } = parsed.data;
    publish({
      kind: "resolution",
      source: "system",
      title: `Demo settlement: ${eventTicker}`,
      detail: `${contractSymbol} → ${resolutionSide.toUpperCase()} (simulated; Gemini settles the real market at game end)`,
      order_id: null,
      href: null,
    });
    const rows = await settleEvent({ eventTicker, contractSymbol, resolutionSide, source: "demo" });
    return Response.json({ settled: rows.length, orders: rows });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  boot();
  if (req.headers.get("x-admin-token") !== env.adminToken) return Response.json({ error: "forbidden" }, { status: 403 });
  return Response.json({ open: openEventTickers() });
}
