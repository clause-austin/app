import { boot } from "@/lib/boot";
import { verifyQuickNodeSignature, ingestStreamPayload } from "@/lib/quicknode";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  boot();
  const raw = await req.text();
  if (env.quickNodeWebhookToken && !verifyQuickNodeSignature(req.headers, raw)) {
    return Response.json({ error: "bad signature" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ error: "not json" }, { status: 400 });
  }
  const n = ingestStreamPayload(payload, "quicknode");
  return Response.json({ ok: true, ingested: n });
}
