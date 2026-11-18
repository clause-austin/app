import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { boot } from "@/lib/boot";
import { currentBuyer, signIn, setBuyerCookie, publicBuyer, clearBuyerCookie, AuthError } from "@/lib/session";
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
  const parsed = z.object({ name: z.string().min(1).max(40), passcode: z.string().min(4).max(72) }).safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Name and a passcode of at least 4 characters." }, { status: 400 });
  try {
    const b = signIn(parsed.data.name, parsed.data.passcode);
    await setBuyerCookie(b.id);
    let balanceCents = 0;
    try {
      if (keysReady()) balanceCents = await usdcBalanceCents(new PublicKey(b.pubkey));
    } catch {
      /* ignore */
    }
    return Response.json({ buyer: publicBuyer(b), balanceCents });
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function DELETE() {
  await clearBuyerCookie();
  return Response.json({ ok: true });
}
