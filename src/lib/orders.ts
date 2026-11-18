/**
 * Order engine: checkout -> hedge -> settle -> rebate.
 */
import { db, newId, type OrderRow, type BuyerRow, type ProductRow, type HedgeRow } from "./db";
import { quote } from "./pricing";
import { getEvent, askFor, type GeminiEvent, type GeminiContract } from "./gemini/public";
import { condition, eventUrl } from "./phrase";
import { geminiTradingEnabled, placeHedgeOrder } from "./gemini/trading";
import { env } from "./env";
import {
  loadKeypair,
  keypairFromSecret,
  transferUsdc,
  explorerTx,
  usdcBalanceCents,
  keysReady,
} from "./solana";
import { PublicKey } from "@solana/web3.js";
import { publish } from "./feed";
import { cents } from "./pricing";

export function getProduct(slug: string): ProductRow | undefined {
  return db().prepare(`SELECT * FROM products WHERE slug = ?`).get(slug) as ProductRow | undefined;
}
export function listProducts(): ProductRow[] {
  return db().prepare(`SELECT * FROM products ORDER BY sort ASC`).all() as ProductRow[];
}
export function sellerNames(ids: string[]): Map<string, string> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const rows = db().prepare(`SELECT id, name FROM buyers WHERE id IN (${ids.map(() => "?").join(",")})`).all(...ids) as { id: string; name: string }[];
  for (const r of rows) out.set(r.id, r.name);
  return out;
}
export function getBuyer(id: string): BuyerRow | undefined {
  return db().prepare(`SELECT * FROM buyers WHERE id = ?`).get(id) as BuyerRow | undefined;
}
export function getOrder(id: string): OrderRow | undefined {
  return db().prepare(`SELECT * FROM orders WHERE id = ?`).get(id) as OrderRow | undefined;
}
export function ordersForBuyer(buyerId: string): OrderRow[] {
  return db().prepare(`SELECT * FROM orders WHERE buyer_id = ? ORDER BY created_at DESC`).all(buyerId) as OrderRow[];
}
export function allOrders(): OrderRow[] {
  return db().prepare(`SELECT * FROM orders ORDER BY created_at DESC`).all() as OrderRow[];
}
export function hedgeForOrder(orderId: string): HedgeRow | undefined {
  return db().prepare(`SELECT * FROM hedges WHERE order_id = ? ORDER BY created_at DESC LIMIT 1`).get(orderId) as
    | HedgeRow
    | undefined;
}
export function allHedges(): HedgeRow[] {
  return db().prepare(`SELECT * FROM hedges ORDER BY created_at DESC`).all() as HedgeRow[];
}

export type ClauseSelection = {
  eventTicker: string;
  contractSymbol: string;
  rebateSide: "yes" | "no";
  loseCents: number;
};

function findContract(e: GeminiEvent, symbol: string): GeminiContract {
  const c = e.contracts.find((x) => x.instrumentSymbol === symbol);
  if (!c) throw new Error(`Contract ${symbol} not on event ${e.ticker}`);
  return c;
}

/**
 * Checkout. Moves W (or B if no clause) from the buyer's invisible wallet into escrow,
 * then fires the hedge. Everything the buyer sees is dollars; the chain is plumbing.
 */
export async function checkout(opts: {
  buyer: BuyerRow;
  product: ProductRow;
  clause?: ClauseSelection;
}): Promise<OrderRow> {
  if (!keysReady()) throw new Error("Solana keys not set up. Run `npm run setup:solana`.");
  const base = opts.product.price_cents;
  const id = newId("ord");
  const now = Date.now();

  let row: OrderRow;
  if (opts.clause) {
    const ev = await getEvent(opts.clause.eventTicker);
    if (ev.status !== "active") throw new Error("That market is no longer open.");
    const c = findContract(ev, opts.clause.contractSymbol);
    const ask = askFor(c, opts.clause.rebateSide);
    if (ask === null) throw new Error("No live price for that outcome.");
    const q = quote(base, opts.clause.loseCents, ask);
    row = {
      id,
      buyer_id: opts.buyer.id,
      product_id: opts.product.id,
      base_cents: base,
      event_ticker: ev.ticker,
      event_title: ev.title,
      contract_symbol: c.instrumentSymbol,
      contract_label: c.label,
      rebate_side: opts.clause.rebateSide,
      hedge_price: q.hedgePrice.toFixed(2),
      win_cents: q.winCents,
      lose_cents: q.loseCents,
      fee_cents: q.feeCents,
      contracts_qty: q.contractsQty.toFixed(2),
      expiry_at: c.expiryDate ? Date.parse(c.expiryDate) : ev.expiryDate ? Date.parse(ev.expiryDate) : null,
      paid_cents: q.winCents,
      pay_tx: null,
      settle_tx: null,
      rebate_tx: null,
      status: "paid",
      outcome: null,
      created_at: now,
      settled_at: null,
      seller_id: opts.product.seller_id ?? null,
      seller_tx: null,
    };
  } else {
    row = {
      id,
      buyer_id: opts.buyer.id,
      product_id: opts.product.id,
      base_cents: base,
      event_ticker: null,
      event_title: null,
      contract_symbol: null,
      contract_label: null,
      rebate_side: null,
      hedge_price: null,
      win_cents: null,
      lose_cents: null,
      fee_cents: 0,
      contracts_qty: null,
      expiry_at: null,
      paid_cents: base,
      pay_tx: null,
      settle_tx: null,
      rebate_tx: null,
      status: "paid",
      outcome: null,
      created_at: now,
      settled_at: null,
      seller_id: opts.product.seller_id ?? null,
      seller_tx: null,
    };
  }

  // 1. Pay: buyer -> escrow
  const buyerKp = keypairFromSecret(opts.buyer.secret);
  const treasury = loadKeypair("treasury");
  const escrow = loadKeypair("escrow");
  const bal = await usdcBalanceCents(buyerKp.publicKey);
  if (bal < row.paid_cents) {
    throw new Error(`Insufficient balance: have ${cents(bal)}, need ${cents(row.paid_cents)}.`);
  }
  const payTx = await transferUsdc({
    from: buyerKp,
    to: escrow.publicKey,
    cents: row.paid_cents,
    feePayer: treasury,
    memo: `clause:${id}:pay`,
  });
  row.pay_tx = payTx;

  db()
    .prepare(
      `INSERT INTO orders (id, buyer_id, product_id, base_cents, event_ticker, event_title, contract_symbol, contract_label,
        rebate_side, hedge_price, win_cents, lose_cents, fee_cents, contracts_qty, expiry_at, paid_cents, pay_tx, settle_tx,
        rebate_tx, status, outcome, created_at, settled_at, seller_id, seller_tx)
       VALUES (@id, @buyer_id, @product_id, @base_cents, @event_ticker, @event_title, @contract_symbol, @contract_label,
        @rebate_side, @hedge_price, @win_cents, @lose_cents, @fee_cents, @contracts_qty, @expiry_at, @paid_cents, @pay_tx, @settle_tx,
        @rebate_tx, @status, @outcome, @created_at, @settled_at, @seller_id, @seller_tx)`,
    )
    .run(row);

  publish({
    kind: "payment",
    source: "solana",
    title: `${cents(row.paid_cents)} USDC into escrow`,
    detail: `${opts.buyer.name} bought ${opts.product.name}${row.event_title ? ` with a clause on ${row.contract_label}` : ""}`,
    order_id: id,
    href: explorerTx(payTx),
  });

  // 2. Hedge (clause orders only). Fire-and-forget so checkout stays snappy; UI streams the result.
  if (row.event_ticker) {
    hedge(row).catch((e) => {
      console.error("[hedge] failed", e);
      publish({ kind: "hedge_error", source: "gemini", title: "Hedge failed", detail: String(e), order_id: id, href: null });
    });
  } else {
    // No clause: settle to merchant immediately.
    await settleNoClause(row);
  }

  return getOrder(id)!;
}

async function settleNoClause(row: OrderRow) {
  const treasury = loadKeypair("treasury");
  const escrow = loadKeypair("escrow");
  const seller = row.seller_id ? getBuyer(row.seller_id) : undefined;
  const to = seller ? new PublicKey(seller.pubkey) : loadKeypair("merchant").publicKey;
  const tx = await transferUsdc({ from: escrow, to, cents: row.paid_cents, feePayer: treasury, memo: `clause:${row.id}:settle` });
  db()
    .prepare(`UPDATE orders SET status='settled', outcome='no_rebate', settle_tx=?, seller_tx=?, settled_at=? WHERE id=?`)
    .run(seller ? null : tx, seller ? tx : null, Date.now(), row.id);
  publish({
    kind: "settlement",
    source: "solana",
    title: `${cents(row.paid_cents)} released to ${seller ? seller.name : "the store"}`,
    detail: "No clause on this order",
    order_id: row.id,
    href: explorerTx(tx),
  });
}

/** Buy N contracts on the rebate side so the merchant is neutral to the outcome. */
export async function hedge(row: OrderRow): Promise<HedgeRow> {
  const qty = Number(row.contracts_qty);
  const price = Number(row.hedge_price);
  const live = geminiTradingEnabled();
  let venue = live ? `gemini:${env.geminiEnv}` : "paper";
  const hid = newId("hdg");
  let status: HedgeRow["status"] = "filled";
  let geminiOrderId: string | null = null;
  let raw: string | null = null;
  let fillPrice = price;
  let fallbackNote: string | null = null;

  if (live) {
    try {
      // limit a tick above the ask so an IOC order fills on a thin book
      const res = await placeHedgeOrder({
        symbol: row.contract_symbol!,
        outcome: row.rebate_side!,
        quantity: qty,
        limitPrice: Math.min(0.99, price + 0.01),
      });
      geminiOrderId = String(res.orderId);
      raw = JSON.stringify(res);
      const filled = Number(res.filledQuantity ?? (res.status === "filled" ? res.quantity : 0));
      status = filled > 0 ? "filled" : "open";
      if (res.avgExecutionPrice) fillPrice = Number(res.avgExecutionPrice);
    } catch (e) {
      // The sandbox lists only a handful of markets (15-minute BTC contracts); sports symbols come
      // from production. When the venue can't take the symbol, book a paper hedge at the live price
      // so the order still settles correctly, and say so in the feed.
      const msg = (e as Error).message;
      console.warn("[hedge] venue rejected order, booking paper hedge:", msg);
      venue = "paper";
      raw = JSON.stringify({ error: msg });
      fallbackNote = /SymbolNotFound/.test(msg) ? `Gemini ${env.geminiEnv} doesn't list this market` : `Gemini ${env.geminiEnv} rejected the order`;
    }
  }

  const costCents = Math.round(qty * fillPrice * 100);
  const h: HedgeRow = {
    id: hid,
    order_id: row.id,
    venue,
    symbol: row.contract_symbol!,
    outcome: row.rebate_side!,
    side: "buy",
    quantity: qty.toFixed(2),
    price: fillPrice.toFixed(2),
    cost_cents: costCents,
    gemini_order_id: geminiOrderId,
    status,
    payout_cents: null,
    raw,
    created_at: Date.now(),
  };
  db()
    .prepare(
      `INSERT INTO hedges (id, order_id, venue, symbol, outcome, side, quantity, price, cost_cents, gemini_order_id, status, payout_cents, raw, created_at)
       VALUES (@id, @order_id, @venue, @symbol, @outcome, @side, @quantity, @price, @cost_cents, @gemini_order_id, @status, @payout_cents, @raw, @created_at)`,
    )
    .run(h);
  db().prepare(`UPDATE orders SET status='hedged' WHERE id=? AND status='paid'`).run(row.id);

  publish({
    kind: "hedge",
    source: "gemini",
    title: `Hedged: bought ${h.quantity} × ${row.contract_label} ${row.rebate_side!.toUpperCase()} @ ${h.price}`,
    detail: `${venue === "paper" ? `${fallbackNote ? fallbackNote + " · " : ""}Paper order at live Gemini price` : `Gemini ${env.geminiEnv} order ${geminiOrderId}`} · cost ${cents(costCents)}`,
    order_id: row.id,
    href: eventUrl(row.event_ticker!),
  });
  return h;
}

/**
 * Settle every open order on an event once the contract has resolved.
 * resolutionSide is for `contractSymbol`. Rebate triggers when it equals the order's rebate_side.
 */
export async function settleEvent(opts: {
  eventTicker: string;
  contractSymbol: string;
  resolutionSide: "yes" | "no";
  source: "gemini" | "demo";
}): Promise<OrderRow[]> {
  const open = db()
    .prepare(`SELECT * FROM orders WHERE event_ticker = ? AND status IN ('paid','hedged')`)
    .all(opts.eventTicker) as OrderRow[];
  if (open.length === 0) return [];

  db()
    .prepare(
      `INSERT OR REPLACE INTO settlements (event_ticker, contract_symbol, resolution_side, source, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(opts.eventTicker, opts.contractSymbol, opts.resolutionSide, opts.source, Date.now());

  const treasury = loadKeypair("treasury");
  const escrow = loadKeypair("escrow");
  const merchant = loadKeypair("merchant");
  const out: OrderRow[] = [];

  for (const o of open) {
    // Resolution may be reported for the other contract of the same game; translate.
    let side = opts.resolutionSide;
    if (o.contract_symbol !== opts.contractSymbol) side = side === "yes" ? "no" : "yes";
    const triggered = side === o.rebate_side;
    const buyer = getBuyer(o.buyer_id)!;
    const buyerPk = new PublicKey(buyer.pubkey);

    const rebateCents = triggered ? o.paid_cents - o.lose_cents! : 0;
    const seller = o.seller_id ? getBuyer(o.seller_id) : undefined;
    const outcomeNote = `${condition(o.contract_label, o.event_ticker, side, "past")} · ${triggered ? "clause triggered" : "clause did not trigger"}`;

    let settleTx: string | null = null;
    let sellerTx: string | null = null;
    let merchantCents = 0; // what the house (platform) books from escrow

    if (!seller) {
      // House listing: the store keeps whatever the escrow holds after any rebate.
      merchantCents = triggered ? o.lose_cents! : o.paid_cents;
      settleTx = await transferUsdc({ from: escrow, to: merchant.publicKey, cents: merchantCents, feePayer: treasury, memo: `clause:${o.id}:settle` });
      publish({ kind: "settlement", source: "solana", title: `${cents(merchantCents)} released to the store`, detail: outcomeNote, order_id: o.id, href: explorerTx(settleTx) });
    } else {
      /* Seller listing: the seller is made whole at list price either way.
         no trigger : escrow -> seller  B            escrow -> house  W - B   (fee + hedge recovery)
         trigger    : escrow -> seller  L            treasury -> seller B - L (the hedge payout, which Gemini pays the house)
         The house is the hedger of record, so it carries the hedge cost and collects the payout. */
      const sellerPk = new PublicKey(seller.pubkey);
      if (!triggered) {
        sellerTx = await transferUsdc({ from: escrow, to: sellerPk, cents: o.base_cents, feePayer: treasury, memo: `clause:${o.id}:seller` });
        publish({ kind: "settlement", source: "solana", title: `${cents(o.base_cents)} paid to ${seller.name}`, detail: `List price in full · ${outcomeNote}`, order_id: o.id, href: explorerTx(sellerTx) });
        merchantCents = o.paid_cents - o.base_cents;
        if (merchantCents > 0) {
          settleTx = await transferUsdc({ from: escrow, to: merchant.publicKey, cents: merchantCents, feePayer: treasury, memo: `clause:${o.id}:settle` });
          publish({ kind: "settlement", source: "solana", title: `${cents(merchantCents)} to Clause`, detail: "Clause fee + hedge cost recovered", order_id: o.id, href: explorerTx(settleTx) });
        }
      } else {
        const fromEscrow = o.lose_cents!;
        const fromHedge = o.base_cents - o.lose_cents!;
        sellerTx = await transferUsdc({ from: escrow, to: sellerPk, cents: fromEscrow, feePayer: treasury, memo: `clause:${o.id}:seller` });
        publish({ kind: "settlement", source: "solana", title: `${cents(fromEscrow)} paid to ${seller.name} from escrow`, detail: outcomeNote, order_id: o.id, href: explorerTx(sellerTx) });
        if (fromHedge > 0) {
          settleTx = await transferUsdc({ from: treasury, to: sellerPk, cents: fromHedge, feePayer: treasury, memo: `clause:${o.id}:hedge-payout` });
          publish({ kind: "settlement", source: "solana", title: `${cents(fromHedge)} paid to ${seller.name} from the hedge`, detail: `Gemini contracts paid out; ${seller.name} nets list price ${cents(o.base_cents)}`, order_id: o.id, href: explorerTx(settleTx) });
        }
        merchantCents = 0;
      }
    }

    let rebateTx: string | null = null;
    if (triggered && rebateCents > 0) {
      rebateTx = await transferUsdc({ from: escrow, to: buyerPk, cents: rebateCents, feePayer: treasury, memo: `clause:${o.id}:rebate` });
      publish({
        kind: "rebate",
        source: "solana",
        title: `${cents(rebateCents)} rebate sent to ${buyer.name}`,
        detail: `Final price ${cents(o.lose_cents!)} instead of ${cents(o.paid_cents)}`,
        order_id: o.id,
        href: explorerTx(rebateTx),
      });
    }

    // Hedge payout: contracts on the rebate side pay $1 each when it triggers.
    const h = hedgeForOrder(o.id);
    if (h) {
      const payout = triggered ? Math.round(Number(h.quantity) * 100) : 0;
      db().prepare(`UPDATE hedges SET status='settled', payout_cents=? WHERE id=?`).run(payout, h.id);
      publish({
        kind: "hedge_settled",
        source: "gemini",
        title: triggered ? `Hedge paid out ${cents(payout)}` : `Hedge expired worthless (cost ${cents(h.cost_cents)})`,
        detail: seller ? `Clause nets ${cents(merchantCents + payout - h.cost_cents)} on this clause` : `Store nets ${cents(merchantCents + payout - h.cost_cents)} either way`,
        order_id: o.id,
        href: null,
      });
    }

    db()
      .prepare(
        `UPDATE orders SET status=?, outcome=?, settle_tx=?, rebate_tx=?, seller_tx=?, settled_at=? WHERE id=?`,
      )
      .run(triggered ? "rebated" : "settled", triggered ? "rebate" : "no_rebate", settleTx, rebateTx, sellerTx, Date.now(), o.id);
    out.push(getOrder(o.id)!);
  }
  return out;
}

export function openEventTickers(): { event_ticker: string; contract_symbol: string }[] {
  return db()
    .prepare(
      `SELECT DISTINCT event_ticker, contract_symbol FROM orders WHERE status IN ('paid','hedged') AND event_ticker IS NOT NULL`,
    )
    .all() as { event_ticker: string; contract_symbol: string }[];
}
