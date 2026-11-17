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

function Header() {
  const path = usePathname();
  const nav = [
    { href: "/", label: "Shop" },
    { href: "/how", label: "How a clause works" },
    { href: "/orders", label: "My orders" },
    { href: "/merchant", label: "Back office" },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-cream/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Mark />
          <div className="leading-tight">
            <div className="font-display text-[19px] font-semibold tracking-tight"><span className="sm:hidden">Burnt Orange</span><span className="hidden sm:inline">Burnt Orange Supply Co.</span></div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-ink-3">Austin, TX · est. this week</div>
          </div>
        </Link>
        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                path === n.href || (n.href !== "/" && path.startsWith(n.href)) ? "bg-ink text-cream" : "text-ink-2 hover:bg-cream-2"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <BuyerChip />
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs transition ${
              path === n.href || (n.href !== "/" && path.startsWith(n.href)) ? "bg-ink text-cream" : "text-ink-2 hover:bg-cream-2"
            }`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function Mark() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
      <rect x="1" y="1" width="32" height="32" rx="8" fill="var(--orange)" />
      <path d="M8 22 L17 10 L26 22" stroke="var(--cream)" strokeWidth="3" fill="none" strokeLinejoin="round" />
      <circle cx="17" cy="24" r="2.2" fill="var(--cream)" />
    </svg>
  );
}

export function BuyerChip() {
  const { buyer, balanceCents, loading, signIn, signOut, topUp } = useBuyer();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (loading) return <div className="h-9 w-28 animate-pulse rounded-full bg-cream-2" />;

  if (!buyer) {
    return (
      <div className="relative">
        <button onClick={() => setOpen((v) => !v)} className="rounded-full border border-ink px-4 py-1.5 text-sm font-medium hover:bg-ink hover:text-cream">
          Sign in
        </button>
        {open && (
          <form
            className="pop absolute right-0 mt-2 w-72 rounded-2xl border border-line bg-paper p-4 shadow-xl"
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
            <div className="font-display text-lg">What should we call you?</div>
            <p className="mt-1 text-xs text-ink-3">No password, no wallet, no seed phrase. Just a name on the receipt.</p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kevin"
              className="mt-3 w-full rounded-lg border border-line bg-cream px-3 py-2 text-sm outline-none focus:border-orange"
            />
            {err && <p className="mt-2 text-xs text-red">{err}</p>}
            <button disabled={busy || !name.trim()} className="mt-3 w-full rounded-lg bg-orange px-3 py-2 text-sm font-semibold text-cream disabled:opacity-50">
              {busy ? "One sec…" : "Continue"}
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-sm hover:border-ink">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-orange text-[11px] font-bold text-cream">{buyer.name[0]?.toUpperCase()}</span>
        <span className="font-medium">{buyer.name}</span>
        <span className="tabular text-ink-3">{cents(balanceCents)}</span>
      </button>
      {open && (
        <div className="pop absolute right-0 mt-2 w-72 rounded-2xl border border-line bg-paper p-4 shadow-xl">
          <div className="text-xs uppercase tracking-widest text-ink-3">Store balance</div>
          <div className="scoreboard mt-1 text-3xl font-semibold">{cents(balanceCents)}</div>
          <div className="mt-3 grid grid-cols-3 gap-2">
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
                className="rounded-lg border border-line bg-cream px-2 py-1.5 text-sm font-medium hover:border-orange disabled:opacity-50"
              >
                +{cents(c).replace(".00", "")}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-ink-3">Adding funds stands in for a card payment. Under the hood it lands as USDC in a wallet you never have to see.</p>
          {err && <p className="mt-2 text-xs text-red">{err}</p>}
          <div className="mt-3 flex items-center justify-between text-xs">
            <Link href="/orders" onClick={() => setOpen(false)} className="underline decoration-line underline-offset-2 hover:decoration-ink">
              My orders
            </Link>
            <button onClick={signOut} className="text-ink-3 hover:text-ink">
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
    <footer className="mt-20 border-t border-line/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-ink-3 md:flex-row md:items-center md:justify-between">
        <div>
          Burnt Orange Supply Co. is a demo store. Prices with a clause are hedged on Gemini prediction markets and settled in USDC on Solana devnet.
        </div>
        <div className="font-mono">clause · UBC 2026</div>
      </div>
    </footer>
  );
}
