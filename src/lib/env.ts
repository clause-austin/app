import path from "node:path";
import { marketStatus } from "./gemini/status";

function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

export const env = {
  solanaRpcUrl: str("SOLANA_RPC_URL", "https://api.devnet.solana.com"),
  usdcMint: str("USDC_MINT", "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
  keysDir: path.resolve(process.cwd(), str("KEYS_DIR", "./.keys")),
  databasePath: path.resolve(process.cwd(), str("DATABASE_PATH", "./data/clause.db")),

  geminiEnv: str("GEMINI_ENV", "sandbox") as "sandbox" | "production",
  geminiApiKey: str("GEMINI_API_KEY"),
  geminiApiSecret: str("GEMINI_API_SECRET"),

  elevenLabsApiKey: str("ELEVENLABS_API_KEY"),
  elevenLabsVoiceId: str("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb"),

  quickNodeWebhookToken: str("QUICKNODE_WEBHOOK_TOKEN"),
  xaiApiKey: str("XAI_API_KEY"),
  adminToken: str("ADMIN_TOKEN", "clause-demo"),
};

/** Which integrations are live vs. running in fallback mode. Surfaced in the merchant dashboard. */
/** Host only: RPC URLs carry provider tokens in the path. */
function redactUrl(u: string): string {
  try {
    const x = new URL(u);
    return `${x.protocol}//${x.host}`;
  } catch {
    return "rpc";
  }
}

export function integrationStatus() {
  return {
    solana: { configured: true, rpc: redactUrl(env.solanaRpcUrl), mint: env.usdcMint, network: "devnet" },
    gemini: {
      marketData: marketStatus.source, // public endpoints need no key; cached/snapshot when Gemini is down
      hedging: env.geminiApiKey && env.geminiApiSecret ? `live:${env.geminiEnv}` : "paper",
    },
    elevenlabs: env.elevenLabsApiKey ? "live" : "browser-speech",
    quicknode: env.quickNodeWebhookToken ? "streams" : "rpc-poller",
    grok: env.xaiApiKey ? "live" : "template",
  };
}
