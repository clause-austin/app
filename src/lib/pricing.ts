/**
 * Clause pricing.
 *
 * A clause turns a fixed price B into a pair (W, L):
 *   - the buyer pays W up front,
 *   - if the chosen market side resolves true, W - L is rebated, so they end up paying L.
 *
 * The merchant hedges by buying N = (W - L) contracts on the rebate side at ask price q
 * (each contract pays $1 if that side resolves). Then:
 *   no rebate:  revenue = W - N*q
 *   rebate:     revenue = L + N - N*q
 * Setting both equal to B gives W = (B - L*q) / (1 - q), and the rebate case is B by construction.
 * The merchant is outcome-neutral. A small clause fee is added on top of W to cover spread.
 */

export const CLAUSE_FEE_BPS = 150; // 1.5% of base price
export const MIN_LOSE_RATIO = 0.1; // buyer can't push the rebate price below 10% of base
export const MAX_WIN_MULTIPLE = 3; // never quote a headline price above 3x base
export const MIN_Q = 0.02;
export const MAX_Q = 0.97;

export type Quote = {
  baseCents: number;
  loseCents: number;
  winCents: number; // includes fee
  feeCents: number;
  rebateCents: number; // winCents - loseCents (what comes back)
  hedgePrice: number; // q
  contractsQty: number; // N, in contracts of $1
  hedgeCostCents: number; // N*q
  merchantRevenueIfRebateCents: number;
  merchantRevenueIfNoRebateCents: number;
  probability: number; // implied probability of the rebate triggering
};

export function clampQ(q: number): number {
  return Math.min(MAX_Q, Math.max(MIN_Q, q));
}

/** Range of lose prices the slider may offer for a given base and ask price. */
export function loseBounds(baseCents: number, q: number): { min: number; max: number } {
  const qq = clampQ(q);
  // W <= MAX_WIN_MULTIPLE*B  =>  (B - L q)/(1-q) <= kB  =>  L >= (B - kB(1-q))/q
  const fromCap = (baseCents - MAX_WIN_MULTIPLE * baseCents * (1 - qq)) / qq;
  const min = Math.max(Math.round(baseCents * MIN_LOSE_RATIO), Math.ceil(fromCap));
  return { min: Math.min(min, baseCents), max: baseCents };
}

export function quote(baseCents: number, loseCents: number, askPrice: number): Quote {
  const q = clampQ(askPrice);
  const { min, max } = loseBounds(baseCents, q);
  const L = Math.min(max, Math.max(min, Math.round(loseCents)));
  const rawW = (baseCents - L * q) / (1 - q);
  const feeCents = Math.round((baseCents * CLAUSE_FEE_BPS) / 10_000);
  const W = Math.round(rawW) + feeCents;
  const rebateCents = W - L;
  // contracts are $1 notional, quantities in 0.01 increments
  const contractsQty = Math.round((rebateCents / 100) * 100) / 100;
  const hedgeCostCents = Math.round(contractsQty * q * 100);
  return {
    baseCents,
    loseCents: L,
    winCents: W,
    feeCents,
    rebateCents,
    hedgePrice: q,
    contractsQty,
    hedgeCostCents,
    merchantRevenueIfNoRebateCents: W - hedgeCostCents,
    merchantRevenueIfRebateCents: L + Math.round(contractsQty * 100) - hedgeCostCents,
    probability: q,
  };
}

export function cents(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${(abs / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}
