/**
 * Minimal, real auth for the demo.
 *  - Accounts are (name, passcode). The passcode is scrypt-hashed. The name is the handle.
 *  - Sessions are HMAC-signed cookies: "<id>.<sig>". The secret comes from SESSION_SECRET
 *    or is generated once and kept in the data dir, so sessions survive restarts.
 *  - The admin desk uses the same signing with a fixed subject, unlocked by ADMIN_TOKEN.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "./env";

let secret: Buffer | null = null;
function key(): Buffer {
  if (secret) return secret;
  if (process.env.SESSION_SECRET) {
    secret = Buffer.from(process.env.SESSION_SECRET, "utf8");
    return secret;
  }
  const file = path.resolve(path.dirname(env.databasePath), ".session-secret");
  try {
    secret = Buffer.from(fs.readFileSync(file, "utf8").trim(), "hex");
  } catch {
    secret = crypto.randomBytes(32);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, secret.toString("hex"), { mode: 0o600 });
  }
  return secret;
}

function b64(buf: Buffer) {
  return buf.toString("base64url");
}

export function sign(subject: string): string {
  const mac = crypto.createHmac("sha256", key()).update(subject).digest();
  return `${subject}.${b64(mac)}`;
}

export function verify(token: string | undefined): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const subject = token.slice(0, i);
  const expected = sign(subject);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return subject;
}

export function hashPasscode(pass: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pass.normalize("NFKC"), salt, 32);
  return `scrypt$${b64(salt)}$${b64(hash)}`;
}

export function checkPasscode(pass: string, stored: string | null): boolean {
  if (!stored) return false;
  const [, saltB, hashB] = stored.split("$");
  const salt = Buffer.from(saltB, "base64url");
  const expected = Buffer.from(hashB, "base64url");
  const got = crypto.scryptSync(pass.normalize("NFKC"), salt, expected.length);
  return crypto.timingSafeEqual(got, expected);
}

export function adminTokenOk(token: string | null | undefined): boolean {
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(env.adminToken);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
