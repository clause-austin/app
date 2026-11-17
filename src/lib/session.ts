/**
 * Buyer session: a cookie that points at a server-custodied "invisible wallet".
 * The buyer never sees keys, addresses or a chain. They see a name and a balance.
 */
import { cookies } from "next/headers";
import { db, newId, type BuyerRow } from "./db";
import { newBuyerKeypair } from "./solana";
import { getBuyer } from "./orders";

const COOKIE = "clause_buyer";

export async function currentBuyer(): Promise<BuyerRow | null> {
  const c = await cookies();
  const id = c.get(COOKIE)?.value;
  if (!id) return null;
  return getBuyer(id) ?? null;
}

export function createBuyer(name: string): BuyerRow {
  const { pubkey, secret } = newBuyerKeypair();
  const row: BuyerRow = { id: newId("byr"), name: name.trim().slice(0, 40) || "Fan", pubkey, secret, created_at: Date.now() };
  db()
    .prepare(`INSERT INTO buyers (id, name, pubkey, secret, created_at) VALUES (@id, @name, @pubkey, @secret, @created_at)`)
    .run(row);
  return row;
}

export async function setBuyerCookie(id: string) {
  const c = await cookies();
  c.set(COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function clearBuyerCookie() {
  const c = await cookies();
  c.delete(COOKIE);
}

export function publicBuyer(b: BuyerRow) {
  return { id: b.id, name: b.name, pubkey: b.pubkey };
}
