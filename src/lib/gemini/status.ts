/** Shared, import-free holder so env.ts can report market-data health without importing the client. */
export type MarketSource = "live" | "cached" | "snapshot";
export const marketStatus: { source: MarketSource; asOf: number; lastError?: string } = { source: "live", asOf: Date.now() };
