import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { boot } from "@/lib/boot";
import { currentBuyer, createBuyer, setBuyerCookie, publicBuyer, clearBuyerCookie } from "@/lib/session";
import { usdcBalanceCents, keysReady } from "@/lib/solana";

export const dynamic = "force-dynamic";

export async function GET() {
  boot();
  const b = await currentBuyer();
  if (!b) return Response.json({ buyer: null });
  let balanceCents = 0;
  try {
    if (keysReady()) balanceCents = await usdcBalanceCents(new PublicKey(b.pubkey));
  } catch {
    /* RPC hiccup: show 0 rather than fail the page */
  }
  return Response.json({ buyer: publicBuyer(b), balanceCents });
}

export async function POST(req: Request) {
  boot();
  const parsed = z.object({ name: z.string().min(1).max(40) }).safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "name required" }, { status: 400 });
  const b = createBuyer(parsed.data.name);
  await setBuyerCookie(b.id);
  return Response.json({ buyer: publicBuyer(b), balanceCents: 0 });
}

export async function DELETE() {
  await clearBuyerCookie();
  return Response.json({ ok: true });
}
