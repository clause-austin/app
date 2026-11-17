"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { OrderRow, ProductRow, HedgeRow } from "@/lib/db";
import { cents } from "@/lib/pricing";
import { useBuyer } from "@/components/buyer";

type Row = OrderRow & { product: ProductRow; hedge: HedgeRow | null };

export default function OrdersPage() {
  const { buyer, loading } = useBuyer();
  const [orders, setOrders] = useState<Row[] | null>(null);
  useEffect(() => {
    if (!buyer) return;
    fetch("/api/orders", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { orders: Row[] }) => setOrders(j.orders));
  }, [buyer]);

  if (loading) return <div className="px-4 py-24 text-center text-ink-3">…</div>;
  if (!buyer)
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <div className="font-display text-3xl">Sign in to see your orders.</div>
        <p className="mt-2 text-ink-3">Use the button in the top right. It only asks for a name.</p>
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-4xl font-semibold">Your orders</h1>
      <p className="mt-1 text-ink-3">Clauses settle on their own. Come back after the game, or don&apos;t; the money finds you.</p>
      <div className="mt-8 space-y-3">
        {orders === null && <div className="text-ink-3">Loading…</div>}
        {orders?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line p-10 text-center text-ink-3">
            Nothing yet.{" "}
            <Link href="/" className="underline">
              Go find something.
            </Link>
          </div>
        )}
        {orders?.map((o) => {
          const settled = o.status === "settled" || o.status === "rebated";
          const triggered = o.outcome === "rebate";
          return (
            <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-paper p-3 transition hover:border-ink">
              <Image src={o.product.image} alt="" width={64} height={64} className="h-16 w-16 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg font-semibold leading-tight">{o.product.name}</div>
                <div className="truncate text-xs text-ink-3">
                  {o.event_title ? `Clause: ${o.contract_label} ${o.rebate_side === "no" ? "lose" : "win"} · ${o.event_title}` : "No clause"}
                </div>
              </div>
              <div className="text-right">
                <div className="scoreboard text-lg font-semibold">{cents(settled && triggered ? o.lose_cents! : o.paid_cents)}</div>
                <div className={`text-[11px] font-medium ${settled ? (triggered ? "text-green" : "text-ink-3") : "text-orange"}`}>
                  {settled ? (triggered ? `rebated ${cents(o.paid_cents - o.lose_cents!)}` : "settled") : o.event_title ? "waiting on the game" : "complete"}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
