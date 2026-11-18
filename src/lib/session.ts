/**
 * Sessions. A signed cookie points at an account row ("buyers": every account has a
 * server-custodied wallet whether it buys or sells). Sign-in is name + passcode:
 * a new name creates the account, a known name must present its passcode.
 */
import { cookies } from "next/headers";
import { db, newId, type BuyerRow } from "./db";
import { newBuyerKeypair } from "./solana";
import { getBuyer } from "./orders";
import { sign, verify, hashPasscode, checkPasscode } from "./auth";

const COOKIE = "clause_session";
const ADMIN_COOKIE = "clause_admin";

export async function currentBuyer(): Promise<BuyerRow | null> {
  const c = await cookies();
  const id = verify(c.get(COOKIE)?.value);
  if (!id) return null;
  return getBuyer(id) ?? null;
}

export function findBuyerByName(name: string): BuyerRow | undefined {
  return db().prepare(`SELECT * FROM buyers WHERE lower(name) = lower(?) ORDER BY created_at ASC LIMIT 1`).get(name.trim()) as BuyerRow | undefined;
}

export class AuthError extends Error {}

/** Name + passcode. Creates the account on first use; otherwise the passcode must match. */
export function signIn(nameRaw: string, passcode: string): BuyerRow {
  const name = nameRaw.trim().slice(0, 40);
  if (!name) throw new AuthError("Name required.");
  if (passcode.length < 4) throw new AuthError("Passcode needs at least 4 characters.");
  const existing = findBuyerByName(name);
  if (existing) {
    if (!existing.pass_hash) {
      // Account from before passcodes existed: first passcode claims it.
      db().prepare(`UPDATE buyers SET pass_hash=? WHERE id=?`).run(hashPasscode(passcode), existing.id);
      return { ...existing, pass_hash: "set" };
    }
    if (!checkPasscode(passcode, existing.pass_hash)) throw new AuthError("That name is taken and the passcode doesn't match.");
    return existing;
  }
  const { pubkey, secret } = newBuyerKeypair();
  const row: BuyerRow = { id: newId("acc"), name, pubkey, secret, created_at: Date.now(), pass_hash: hashPasscode(passcode) };
  db()
    .prepare(`INSERT INTO buyers (id, name, pubkey, secret, created_at, pass_hash) VALUES (@id, @name, @pubkey, @secret, @created_at, @pass_hash)`)
    .run(row);
  return row;
}

export async function setBuyerCookie(id: string) {
  const c = await cookies();
  c.set(COOKIE, sign(id), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function clearBuyerCookie() {
  const c = await cookies();
  c.delete(COOKIE);
}

export function publicBuyer(b: BuyerRow) {
  return { id: b.id, name: b.name, pubkey: b.pubkey };
}

export async function isAdmin(req?: Request): Promise<boolean> {
  const c = await cookies();
  if (verify(c.get(ADMIN_COOKIE)?.value) === "admin") return true;
  // Header still accepted for scripts / curl.
  const h = req?.headers.get("x-admin-token");
  if (h) {
    const { adminTokenOk } = await import("./auth");
    return adminTokenOk(h);
  }
  return false;
}

export async function setAdminCookie() {
  const c = await cookies();
  c.set(ADMIN_COOKIE, sign("admin"), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
}

export async function clearAdminCookie() {
  const c = await cookies();
  c.delete(ADMIN_COOKIE);
}
