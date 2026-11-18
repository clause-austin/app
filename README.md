<p align="center">
  <img src="docs/wordmark.svg" width="520" alt="Clause: pay less if they lose">
</p>

<h1 align="center">Clause</h1>

<p align="center">
  <b>Pay less if they lose.</b><br>
  A checkout where any price can carry a real-world condition, because a prediction market lets the store hedge it.
</p>

<p align="center">
  Built for the University Blockchain Conference 2026 hackathon · Consumer Applications · Best use of Solana · Gemini Prediction Markets · QuickNode Streams · ElevenLabs
</p>

---

## What it is

The demo store sells Texas gameday gear. Every item has a sticker price and, optionally, a **clause**:

> Gameday Hoodie, $68. Or pay **$73.77 today and get $53.77 back if Texas lose**, so it cost you $20.

Fans have always wanted a price that depends on the game. Stores have never offered one, because a loss would mean eating the discount on every item sold that week. Clause makes it safe:

1. **The fan names a bad-day price.** They pick the game, the team, and what they'd like to have paid if it goes wrong. Clause solves for today's price from the live odds.
2. **The store hedges instantly.** At checkout, Clause buys the matching contract on Gemini's prediction market (e.g. "Texas lose" at $0.09). The store's revenue is identical whichever way the game goes.
3. **Money moves itself.** The fan's payment sits in a USDC escrow on Solana. When Gemini settles the market, the escrow pays the store and sends the rebate back automatically. No refunds desk.

The fan never sees a wallet, a chain, or a market. They see a toggle, a slider, and a receipt.

**Anyone can sell.** Clause is a marketplace, not a single store. `/sell` lets any account list an item with a photo and a list price; it appears in Goods beside the house items and takes clauses on any open Gemini market. The seller is paid the list price in USDC whichever way the game goes: Clause is the hedger of record, carries the hedge, collects the payout, and keeps the 1.5% clause fee. That is the business model.

## The math

For sticker price `B`, the fan's chosen bad-day price `L`, and `q` the market ask for the clause triggering:

```
W = (B − L·q) / (1 − q)         price paid today
N = W − L                        contracts bought at q (each pays $1 if the clause triggers)

no trigger:  store keeps W,  hedge expires        → W − N·q        = B
trigger:     store keeps L,  hedge pays N         → L + N − N·q    = B
```

The store nets `B` either way, plus a 1.5% clause fee that covers the spread. See `src/lib/pricing.ts`, which is the entire pricing engine, and `/how` in the app for a worked example.

## Architecture

```
                    ┌──────────────────────────────────────────────────────┐
  fan's browser ───►│  Next.js 16 (app router)                             │
                    │                                                      │
                    │  /p/[slug]   ClauseBuilder  ──► /api/quote           │
                    │  /orders/id  Receipt (SSE)  ◄── /api/stream          │
                    │  /merchant   Clause desk    ◄── /api/merchant        │
                    │                                                      │
                    │  src/lib/orders.ts   checkout → hedge → settle       │
                    │  src/lib/pricing.ts  W = (B − Lq)/(1 − q)            │
                    │  src/lib/resolver.ts polls Gemini settlements (30s)  │
                    │  SQLite (better-sqlite3)  orders · hedges · feed     │
                    └───┬───────────────┬──────────────┬───────────────┬───┘
                        │               │              │               │
                        ▼               ▼              ▼               ▼
                 Gemini Prediction   Solana devnet   QuickNode       ElevenLabs
                 Markets API         USDC (SPL)      Streams         TTS
                 · public prices     · buyer wallet  · escrow        · settlement
                   drive every quote   (invisible)     webhook         announcement
                 · hedge orders      · escrow vault  · signature
                   (sandbox/prod)    · merchant        verified
                 · settlement poll   · memo'd txs    · RPC poller
                                                       fallback
```

**Money flow on Solana** (all SPL USDC transfers, memo-tagged `clause:<order>:<step>`):

| Step | From | To | Amount |
|---|---|---|---|
| Add funds (card on-ramp stand-in) | treasury | buyer wallet | top-up |
| Checkout | buyer wallet | escrow | `W` |
| Settlement, no trigger | escrow | merchant | `W` |
| Settlement, trigger | escrow | merchant | `L` |
| Rebate, trigger | escrow | buyer wallet | `W − L` |
| Seller listing, no trigger | escrow | seller wallet, then house | `B` to seller, `W − B` to house |
| Seller listing, trigger | escrow + hedge payout | seller wallet | `L` from escrow, `B − L` from the hedge |

The treasury is fee payer for every transaction, so buyers never hold SOL. Every account (buyer or seller) gets a server-custodied keypair the moment it is created, which is what makes the chain invisible at checkout.

**Auth.** Accounts are a name plus a passcode (scrypt-hashed). A new name creates the account; a known name must present its passcode. Sessions are HMAC-signed httpOnly cookies (`SESSION_SECRET`, or a secret generated once into the data dir). The back-office resolution desk is locked behind `ADMIN_TOKEN`, entered on the Ledger page and held as a separate signed cookie; the API also accepts it as an `x-admin-token` header for scripts. A production version would swap in Circle Programmable Wallets or Privy embedded wallets; the transfer logic in `src/lib/solana.ts` is unchanged.

**Hedging on Gemini.** Quotes always read live public prices from `api.gemini.com/v1/prediction-markets` (no key needed). With `GEMINI_API_KEY`/`SECRET` set, each clause places an immediate-or-cancel limit order on the rebate side via `POST /v1/prediction-markets/order`; without keys, hedges are recorded as paper fills at the live ask and labelled as such in the back office. Settlement is read from `contract.resolutionSide` on the event.

**Escrow watcher.** A QuickNode Streams Solana stream (filter source in `docs/quicknode-filter.go`, JS twin in `docs/quicknode-filter.js`) filtered to the escrow address posts to `/api/webhooks/quicknode`; the HMAC signature (`x-qn-nonce + x-qn-timestamp + body`) is verified before ingest. Without a stream token, an in-process RPC poller emits identical feed events so the dashboard behaves the same.

**Voice.** On settlement the receipt page announces the result ("Kevin, Texas lost. Your clause just triggered…") via ElevenLabs TTS, cached per order; without a key it falls back to the browser's speech synthesis.

**Checkout copy.** The one-line plain-English explanation under the slider is written by Grok (`grok-4-fast`) when `XAI_API_KEY` is set, otherwise from a template.

## Running it

```sh
npm install
cp .env.example .env.local        # everything optional; see below
npm run setup:solana              # creates ./.keys/{treasury,escrow,merchant}.json, prints addresses
npm run dev                       # http://localhost:3000
```

Fund the **treasury** address printed by setup with devnet SOL (https://faucet.solana.com) and devnet USDC (https://faucet.circle.com → Solana Devnet). That is the only manual step; everything else is automatic.

For fully offline development, `npm run setup:solana -- --test-mint` against a local `solana-test-validator` creates a throwaway 6-decimal mint and funds the treasury.

### Environment

| Variable | Effect when set | Fallback when unset |
|---|---|---|
| `SOLANA_RPC_URL` | RPC endpoint (a QuickNode devnet endpoint is ideal) | public devnet |
| `USDC_MINT` | SPL mint for payments | Circle devnet USDC `4zMMC9…ncDU` |
| `GEMINI_API_KEY`, `GEMINI_API_SECRET`, `GEMINI_ENV` | Real hedge orders on Gemini sandbox/production | Paper hedges at live prices |
| `QUICKNODE_WEBHOOK_TOKEN` | Verifies QuickNode Streams webhooks | RPC poller on the escrow wallet |
| `ELEVENLABS_API_KEY` | Spoken settlement announcements | Browser speech synthesis |
| `XAI_API_KEY` | Grok writes the checkout explanation | Templated copy |
| `ADMIN_TOKEN` | Unlocks the demo settlement desk | `clause-demo` |
| `SESSION_SECRET` | Signs session cookies | generated once into `data/` |

### Demo settlement

Gemini settles each market when the game ends and the resolver picks it up within 30 seconds. For a live demo the back office (`/merchant`) can call a result immediately; the escrow, rebate and hedge accounting run exactly as they would for real, with the settlement source recorded as `demo`.

## Repository map

| Path | What |
|---|---|
| `src/lib/pricing.ts` | Clause math and bounds |
| `src/lib/orders.ts` | Checkout, hedge, settle, rebate |
| `src/lib/gemini/` | Public market data client, authenticated trading client |
| `src/lib/solana.ts` | Keypairs, USDC transfers, balances |
| `src/lib/quicknode.ts` | Streams webhook verification + RPC poller fallback |
| `src/lib/resolver.ts` | Settlement poller |
| `src/lib/voice.ts`, `src/lib/copilot.ts` | ElevenLabs, Grok |
| `src/components/ClauseBuilder.tsx` | The product-page clause UI |
| `src/components/Receipt.tsx` | Live receipt with timeline and voice |
| `src/components/Merchant.tsx` | Back office: clause book, P&L, settlement, live wire |
| `src/components/Sell.tsx`, `src/app/api/listings/` | Seller listings, uploads, per-seller sales |
| `src/lib/auth.ts`, `src/lib/session.ts` | Passcodes, signed cookies, admin session |
| `scripts/setup-solana.ts` | Key generation, airdrop, optional test mint |

## What we'd build next

- Embedded wallets (Circle Programmable Wallets / Privy) so Clause never custodies keys.
- Seller payouts to an external wallet or bank, and a Shopify/Stripe app so existing stores can switch clauses on.
- An on-chain escrow program with per-order PDAs, so settlement is verifiable without trusting the store.
- Clauses on anything with a market: concert tickets refunded if the headliner cancels, flights hedged against weather markets, rent that drops if the Fed hikes.
- A Shopify app: one toggle on the product page, Clause handles pricing, hedging and settlement behind it.

## Team

Built during UBC 2026 hackathon week (Nov 13–20, 2026) at UT Austin.
