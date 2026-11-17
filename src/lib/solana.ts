/**
 * Solana devnet rails. USDC (SPL) transfers between server-custodied keypairs:
 *   treasury  -> buyer     (top-up; stands in for the card on-ramp)
 *   buyer     -> escrow    (checkout: buyer pays the clause price W)
 *   escrow    -> merchant  (settlement: L or W depending on outcome)
 *   escrow    -> buyer     (rebate: W - L when the clause triggers)
 */
import fs from "node:fs";
import path from "node:path";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getMint,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import bs58 from "bs58";
import { env } from "./env";

const g = globalThis as unknown as { __clauseConn?: Connection; __clauseDecimals?: number };

export function connection(): Connection {
  if (!g.__clauseConn) g.__clauseConn = new Connection(env.solanaRpcUrl, "confirmed");
  return g.__clauseConn;
}

export const USDC_MINT = new PublicKey(env.usdcMint);

export type KeyRole = "treasury" | "escrow" | "merchant";

export function loadKeypair(role: KeyRole): Keypair {
  const p = path.join(env.keysDir, `${role}.json`);
  if (!fs.existsSync(p)) {
    throw new Error(`Missing keypair ${p}. Run: npm run setup:solana`);
  }
  const raw = JSON.parse(fs.readFileSync(p, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export function keysReady(): boolean {
  return (["treasury", "escrow", "merchant"] as KeyRole[]).every((r) =>
    fs.existsSync(path.join(env.keysDir, `${r}.json`)),
  );
}

export function keypairFromSecret(secretB58: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(secretB58));
}

export function newBuyerKeypair(): { pubkey: string; secret: string } {
  const kp = Keypair.generate();
  return { pubkey: kp.publicKey.toBase58(), secret: bs58.encode(kp.secretKey) };
}

export async function usdcDecimals(): Promise<number> {
  if (g.__clauseDecimals !== undefined) return g.__clauseDecimals;
  const m = await getMint(connection(), USDC_MINT);
  g.__clauseDecimals = m.decimals;
  return m.decimals;
}

export function centsToUnits(cents: number, decimals: number): bigint {
  // cents -> base units: cents * 10^(decimals-2)
  return BigInt(Math.round(cents)) * 10n ** BigInt(decimals - 2);
}

export async function usdcBalanceCents(owner: PublicKey): Promise<number> {
  const decimals = await usdcDecimals();
  const ata = getAssociatedTokenAddressSync(USDC_MINT, owner);
  try {
    const acc = await getAccount(connection(), ata);
    return Number(acc.amount / 10n ** BigInt(decimals - 2));
  } catch (e) {
    if (e instanceof TokenAccountNotFoundError) return 0;
    throw e;
  }
}

export async function solBalance(owner: PublicKey): Promise<number> {
  return (await connection().getBalance(owner)) / LAMPORTS_PER_SOL;
}

/**
 * Transfer USDC. `feePayer` (treasury) pays rent for a missing destination token
 * account and the network fee, so buyers never need to hold SOL.
 */
export async function transferUsdc(opts: {
  from: Keypair;
  to: PublicKey;
  cents: number;
  feePayer: Keypair;
  memo?: string;
}): Promise<string> {
  const conn = connection();
  const decimals = await usdcDecimals();
  const amount = centsToUnits(opts.cents, decimals);
  const fromAta = getAssociatedTokenAddressSync(USDC_MINT, opts.from.publicKey);
  const toAta = getAssociatedTokenAddressSync(USDC_MINT, opts.to);

  const tx = new Transaction();
  tx.add(createAssociatedTokenAccountIdempotentInstruction(opts.feePayer.publicKey, toAta, opts.to, USDC_MINT));
  tx.add(createTransferCheckedInstruction(fromAta, USDC_MINT, toAta, opts.from.publicKey, amount, decimals));
  if (opts.memo) {
    tx.add({
      keys: [],
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      data: Buffer.from(opts.memo, "utf8"),
    });
  }
  tx.feePayer = opts.feePayer.publicKey;
  const signers = opts.from.publicKey.equals(opts.feePayer.publicKey) ? [opts.feePayer] : [opts.feePayer, opts.from];
  return sendAndConfirmTransaction(conn, tx, signers, { commitment: "confirmed" });
}

export async function airdropSol(to: PublicKey, sol = 1): Promise<string> {
  const sig = await connection().requestAirdrop(to, sol * LAMPORTS_PER_SOL);
  await connection().confirmTransaction(sig, "confirmed");
  return sig;
}

export async function sendSol(from: Keypair, to: PublicKey, sol: number): Promise<string> {
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to, lamports: Math.round(sol * LAMPORTS_PER_SOL) }),
  );
  return sendAndConfirmTransaction(connection(), tx, [from]);
}

export function explorerTx(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}
export function explorerAddress(addr: string): string {
  return `https://explorer.solana.com/address/${addr}?cluster=devnet`;
}
