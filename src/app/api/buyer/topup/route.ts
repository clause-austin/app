/**
 * "Add funds". Stands in for a card on-ramp: treasury sends devnet USDC to the buyer's
 * invisible wallet. Capped so a demo can't drain the treasury.
 */
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { boot } from "@/lib/boot";
import { currentBuyer } from "@/lib/session";
import { loadKeypair, transferUsdc, usdcBalanceCents, explorerTx } from "@/lib/solana";
import { publish } from "@/lib/feed";
import { cents } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  boot();
  const b = await currentBuyer();
  if (!b) return Response.json({ error: "no session" }, { status: 401 });
  const parsed = z.object({ cents: z.number().int().min(100).max(50_000) }).safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "bad amount" }, { status: 400 });
  try {
    const treasury = loadKeypair("treasury");
    const tx = await transferUsdc({
      from: treasury,
      to: new PublicKey(b.pubkey),
      cents: parsed.data.cents,
      feePayer: treasury,
      memo: `clause:topup:${b.id}`,
    });
    publish({
      kind: "topup",
      source: "solana",
      title: `${cents(parsed.data.cents)} added for ${b.name}`,
      detail: "Card on-ramp stand-in: treasury → buyer wallet",
      order_id: null,
      href: explorerTx(tx),
    });
    const balanceCents = await usdcBalanceCents(new PublicKey(b.pubkey));
    return Response.json({ ok: true, tx, balanceCents });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
