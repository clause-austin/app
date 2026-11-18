"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BuyerProvider, useBuyer } from "./buyer";
import { cents } from "@/lib/pricing";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <BuyerProvider>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </BuyerProvider>
  );
}

const NAV = [
  { href: "/", label: "Goods" },
  { href: "/how", label: "Mechanics" },
  { href: "/orders", label: "Orders" },
  { href: "/merchant", label: "Ledger" },
];

function Header() {
  const path = usePathname();
  const active = (href: string) => path === href || (href !== "/" && path.startsWith(href));
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-8 px-4 md:px-6">
        <Link href="/" className="flex items-baseline gap-3 py-3.5">
          <span className="serif text-[26px] leading-none">Clause</span>
          <span className="label hidden sm:inline">Pay less if they lose</span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`label py-4 transition hover:!text-ink ${active(n.href) ? "!text-ink underline decoration-red underline-offset-[18px]" : ""}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <BuyerChip />
        </div>
      </div>
      <nav className="flex gap-6 overflow-x-auto border-t border-line-2 px-4 md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`label whitespace-nowrap py-2.5 ${active(n.href) ? "!text-ink" : ""}`}>
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function BuyerChip() {
  const { buyer, balanceCents, loading, signIn, signOut, topUp } = useBuyer();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (loading) return <div className="h-4 w-24 bg-paper-2" />;

  if (!buyer) {
    return (
      <div className="relative">
        <button onClick={() => setOpen((v) => !v)} className="label !text-ink hover:underline underline-offset-4">
          Sign in
        </button>
        {open && (
          <form
            className="rise absolute right-0 top-9 w-72 border border-ink bg-paper p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setErr(null);
              try {
                await signIn(name);
                setOpen(false);
              } catch (er) {
                setErr((er as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="label">Party of the first part</div>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="blank serif mt-2 w-full text-2xl" />
            <p className="mt-3 text-xs leading-relaxed text-ink-3">No password, no wallet, no seed phrase. A name is all a receipt needs.</p>
            {err && <p className="mt-2 text-xs text-red">{err}</p>}
            <button disabled={busy || !name.trim()} className="btn mt-4 w-full">
              {busy ? "One moment" : "Continue"}
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="mono flex items-center gap-3 text-[12px] hover:underline underline-offset-4">
        <span>{buyer.name}</span>
        <span className="text-ink-3">{cents(balanceCents)}</span>
      </button>
      {open && (
        <div className="rise absolute right-0 top-9 w-72 border border-ink bg-paper p-4">
          <div className="label">Balance on account</div>
          <div className="num mt-1 text-3xl">{cents(balanceCents)}</div>
          <div className="mt-4 grid grid-cols-3 gap-px bg-line">
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
                className="mono bg-paper py-2 text-xs hover:bg-paper-2 disabled:opacity-50"
              >
                +{cents(c).replace(".00", "")}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-3">Adding funds stands in for a card payment. It lands as USDC in a wallet you never have to see.</p>
          {err && <p className="mt-2 text-xs text-red">{err}</p>}
          <div className="mt-4 flex items-center justify-between">
            <Link href="/orders" onClick={() => setOpen(false)} className="label !text-ink hover:underline underline-offset-4">
              Orders
            </Link>
            <button onClick={signOut} className="label hover:!text-ink">
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
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 md:grid-cols-3 md:px-6">
        <div className="label">Clause · UBC 2026</div>
        <div className="text-xs leading-relaxed text-ink-3 md:col-span-2">
          A demonstration. Prices with a clause are hedged on Gemini prediction markets and settled in USDC on Solana devnet. Nothing here is an offer to anyone, which is a sentence you only find at the bottom of a page like this.
        </div>
      </div>
    </footer>
  );
}
