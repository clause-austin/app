/**
 * One-shot Solana devnet setup.
 *   npm run setup:solana               -> generate treasury/escrow/merchant keypairs, airdrop SOL
 *   npm run setup:solana -- --test-mint -> ALSO create a throwaway 6-decimal "USDC" mint, mint 1,000,000 to treasury,
 *                                          and write USDC_MINT into .env.local (for testing without Circle's faucet)
 *
 * For the real devnet USDC mint, fund the treasury address printed below at https://faucet.circle.com
 */
import fs from "node:fs";
import path from "node:path";
import { Keypair, LAMPORTS_PER_SOL, Connection, PublicKey } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const getEnv = (k: string, d: string) => envText.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim() || d;

const rpc = getEnv("SOLANA_RPC_URL", "https://api.devnet.solana.com");
const keysDir = path.resolve(root, getEnv("KEYS_DIR", "./.keys"));
const testMint = process.argv.includes("--test-mint");
fs.mkdirSync(keysDir, { recursive: true });

const conn = new Connection(rpc, "confirmed");

function loadOrCreate(role: string): Keypair {
  const p = path.join(keysDir, `${role}.json`);
  if (fs.existsSync(p)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8"))));
  const kp = Keypair.generate();
  fs.writeFileSync(p, JSON.stringify(Array.from(kp.secretKey)));
  console.log(`created ${role}: ${kp.publicKey.toBase58()}`);
  return kp;
}

async function airdropIfLow(kp: Keypair, label: string, min = 0.5) {
  const bal = (await conn.getBalance(kp.publicKey)) / LAMPORTS_PER_SOL;
  console.log(`${label} ${kp.publicKey.toBase58()} SOL=${bal.toFixed(3)}`);
  if (bal >= min) return;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const sig = await conn.requestAirdrop(kp.publicKey, 1 * LAMPORTS_PER_SOL);
      await conn.confirmTransaction(sig, "confirmed");
      console.log(`  airdropped 1 SOL -> ${label}`);
      return;
    } catch (e) {
      console.warn(`  airdrop attempt ${attempt + 1} failed: ${(e as Error).message.slice(0, 120)}`);
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
  console.warn(`  Could not airdrop to ${label}. Use https://faucet.solana.com with the address above.`);
}

async function main() {
  const treasury = loadOrCreate("treasury");
  const escrow = loadOrCreate("escrow");
  const merchant = loadOrCreate("merchant");
  await airdropIfLow(treasury, "treasury", 1);
  // escrow and merchant never pay fees (treasury is fee payer), SOL not required.

  if (testMint) {
    console.log("creating test USDC mint (6 decimals)...");
    const mint = await createMint(conn, treasury, treasury.publicKey, null, 6);
    const ata = await getOrCreateAssociatedTokenAccount(conn, treasury, mint, treasury.publicKey);
    await mintTo(conn, treasury, mint, ata.address, treasury, 1_000_000n * 1_000_000n);
    console.log(`test mint: ${mint.toBase58()} (1,000,000 minted to treasury)`);
    const next = envText.match(/^USDC_MINT=.*$/m)
      ? envText.replace(/^USDC_MINT=.*$/m, `USDC_MINT=${mint.toBase58()}`)
      : envText + `\nUSDC_MINT=${mint.toBase58()}\n`;
    fs.writeFileSync(envPath, next);
    console.log("wrote USDC_MINT to .env.local");
  } else {
    const mint = new PublicKey(getEnv("USDC_MINT", "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"));
    console.log(`\nUSDC mint in use: ${mint.toBase58()}`);
    console.log(`Fund the TREASURY with devnet USDC at https://faucet.circle.com -> Solana Devnet -> ${treasury.publicKey.toBase58()}`);
  }
  console.log(`\nescrow:   ${escrow.publicKey.toBase58()}`);
  console.log(`merchant: ${merchant.publicKey.toBase58()}`);
  console.log(`\nQuickNode Streams filter address (escrow): ${escrow.publicKey.toBase58()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
