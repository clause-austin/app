/** Server-sent events: live feed for the receipt page and the merchant dashboard. */
import { NextRequest } from "next/server";
import { boot } from "@/lib/boot";
import { subscribe, recentFeed } from "@/lib/feed";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  boot();
  const orderId = req.nextUrl.searchParams.get("order") ?? undefined;
  const enc = new TextEncoder();
  let unsub: (() => void) | null = null;
  let ping: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      send("hello", { now: Date.now(), backlog: recentFeed(40, orderId).reverse() });
      unsub = subscribe((row) => {
        if (orderId && row.order_id !== orderId) return;
        send("feed", row);
      });
      ping = setInterval(() => controller.enqueue(enc.encode(`: ping\n\n`)), 15_000);
    },
    cancel() {
      unsub?.();
      if (ping) clearInterval(ping);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
