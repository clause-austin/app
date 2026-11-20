"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BuyerProvider, useBuyer } from "./buyer";
import { SignInInline } from "./SignInInline";
import { cents } from "@/lib/pricing";
import { Mark } from "./Mark";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <BuyerProvider>
      <div className="mx-auto w-full max-w-[1440px] px-3 py-3 md:px-6 md:py-5">
        <div className="frame">
          <Header />
          <main>{children}</main>
          <Footer />
        </div>
      </div>
    </BuyerProvider>
  );
}

const NAV = [
  { href: "/", label: "Goods" },
  { href: "/how", label: "How" },
  { href: "/sell", label: "Sell" },
  { href: "/orders", label: "Orders" },
  { href: "/merchant", label: "Ledger" },
];

function Header() {
  const path = usePathname();
  const active = (href: string) => path === href || (href !== "/" && path.startsWith(href));
  return (
    <header className="sticky top-0 z-40 border-b border-fg bg-bg">
      <div className="grid-lines grid-cols-[auto_1fr_auto] md:grid-cols-[180px_1fr_auto]">
        <Link href="/" className="cell inv flex items-center gap-3 px-4 py-3 text-[18px] font-extrabold uppercase tracking-[-0.04em] md:text-[22px]">
          <Mark size={22} />
          Clause
        </Link>
        <nav className="cell flex overflow-x-auto">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`inv flex items-center border-r border-fg px-4 text-[11px] font-bold uppercase tracking-[0.1em] ${active(n.href) ? "bg-fg text-bg" : ""}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="cell flex items-stretch">
          <BuyerChip />
        </div>
      </div>
    </header>
  );
}

export function BuyerChip() {
  const { buyer, balanceCents, loading, signOut, topUp } = useBuyer();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (loading) return <div className="w-28" />;

  return (
    <div className="relative flex">
      <button onClick={() => setOpen((v) => !v)} className={`inv flex items-center gap-3 px-4 text-[11px] font-bold uppercase tracking-[0.1em] ${open ? "bg-fg text-bg" : ""}`}>
        {buyer ? (
          <>
            <span>{buyer.name}</span>
            <span className="font-normal opacity-60">{cents(balanceCents)}</span>
          </>
        ) : (
          "Sign in"
        )}
      </button>
      {open && !buyer && (
        <div className="rise frame absolute right-[-1px] top-[calc(100%+1px)] w-80 bg-bg">
          <div className="tag border-b border-fg px-4 py-2">Who are you</div>
          <SignInInline onDone={() => setOpen(false)} />
        </div>
      )}
      {open && buyer && (
        <div className="rise frame absolute right-[-1px] top-[calc(100%+1px)] w-80 bg-bg">
          <div className="tag border-b border-fg px-4 py-2">Balance on account</div>
          <div className="num-lg px-4 py-4">{cents(balanceCents)}</div>
          <div className="grid-lines grid-cols-3 border-y border-fg">
            {[5000, 10000, 25000].map((c) => (
              <button
                key={c}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setErr(null);
                  try {
                    await topUp(c);
                  } catch (er) {
                    setErr((er as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="cell inv py-3 text-[12px] font-bold disabled:opacity-50"
              >
                +{cents(c).replace(".00", "")}
              </button>
            ))}
          </div>
          <p className="px-4 py-3 text-[11px] leading-relaxed text-mute">Adding funds stands in for a card payment. It lands as USDC in a wallet you never see.</p>
          {err && <p className="px-4 pb-2 text-[11px] text-acc">{err}</p>}
          <div className="grid-lines grid-cols-2 border-t border-fg">
            <Link href="/orders" onClick={() => setOpen(false)} className="cell inv px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.1em]">
              Orders
            </Link>
            <button onClick={signOut} className="cell inv px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em]">
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer className="grid-lines grid-cols-1 border-t border-fg md:grid-cols-[180px_1fr_auto]">
      <div className="cell px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em]">Clause</div>
      <div className="cell px-4 py-3 text-[11px] leading-relaxed text-mute">
        A demonstration built in a week. Prices with a clause are hedged on Gemini prediction markets and settled in USDC on Solana devnet. Nothing here is an offer to anyone.
      </div>
      <div className="cell px-4 py-3 text-[11px] uppercase tracking-[0.1em] text-mute">UBC 2026 · Austin</div>
    </footer>
  );
}
