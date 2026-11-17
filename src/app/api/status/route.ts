import { boot } from "@/lib/boot";
import { integrationStatus } from "@/lib/env";
import { keysReady } from "@/lib/solana";

export const dynamic = "force-dynamic";

export async function GET() {
  boot();
  return Response.json({ ok: true, keysReady: keysReady(), integrations: integrationStatus() });
}
