"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Buyer = { id: string; name: string; pubkey: string };

type Ctx = {
  buyer: Buyer | null;
  balanceCents: number;
  loading: boolean;
  refresh: () => Promise<void>;
  signIn: (name: string, passcode: string) => Promise<void>;
  signOut: () => Promise<void>;
  topUp: (cents: number) => Promise<void>;
};

const BuyerCtx = createContext<Ctx | null>(null);

export function BuyerProvider({ children }: { children: React.ReactNode }) {
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [balanceCents, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/buyer", { cache: "no-store" });
    const j = (await r.json()) as { buyer: Buyer | null; balanceCents?: number };
    setBuyer(j.buyer);
    setBalance(j.balanceCents ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  const signIn = useCallback(
    async (name: string, passcode: string) => {
      const r = await fetch("/api/buyer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, passcode }) });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Could not sign in");
      await refresh();
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    await fetch("/api/buyer", { method: "DELETE" });
    setBuyer(null);
    setBalance(0);
  }, []);

  const topUp = useCallback(
    async (cents: number) => {
      const r = await fetch("/api/buyer/topup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cents }) });
      const j = (await r.json()) as { error?: string; balanceCents?: number };
      if (!r.ok) throw new Error(j.error ?? "Top-up failed");
      setBalance(j.balanceCents ?? 0);
    },
    [],
  );

  const value = useMemo(() => ({ buyer, balanceCents, loading, refresh, signIn, signOut, topUp }), [buyer, balanceCents, loading, refresh, signIn, signOut, topUp]);
  return <BuyerCtx.Provider value={value}>{children}</BuyerCtx.Provider>;
}

export function useBuyer(): Ctx {
  const c = useContext(BuyerCtx);
  if (!c) throw new Error("useBuyer outside provider");
  return c;
}
