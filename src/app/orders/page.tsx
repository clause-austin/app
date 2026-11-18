"use client";

import { condition } from "@/lib/phrase";
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

  if (loading) return <div className="tag px-4 py-24 text-center">Loading</div>;
  if (!buyer)
    return (
      <div className="px-4 py-20">
        <div className="h-lg">Sign in to see your orders.</div>
        <p className="mt-4 text-mute">Top right. It only asks for a name.</p>
      </div>
    );

  return (
    <div>
      <div className="grid-lines grid-cols-[1fr_auto] border-b border-fg">
        <div className="cell flex items-baseline gap-4 px-4 py-3">
          <span className="h-md">Orders</span>
          <span className="tag">{buyer.name}</span>
        </div>
        <div className="cell tag flex items-center px-4">Clauses settle themselves. The money finds you.</div>
      </div>
      {orders === null && <div className="tag px-4 py-8">Loading</div>}
      {orders?.length === 0 && (
        <div className="px-4 py-16 text-mute">
          Nothing yet.{" "}
          <Link href="/" className="font-bold text-fg underline">
            Build one.
          </Link>
        </div>
      )}
      {orders && orders.length > 0 && (
        <div className="grid-lines grid-cols-1">
          {orders.map((o) => {
            const settled = o.status === "settled" || o.status === "rebated";
            const triggered = o.outcome === "rebate";
            return (
              <Link key={o.id} href={`/orders/${o.id}`} className="cell inv grid grid-cols-[72px_1fr_auto] items-stretch md:grid-cols-[96px_1.4fr_1.4fr_1fr_1fr_1fr]">
                <div className="relative border-r border-fg bg-faint">
                  <Image src={o.product.image} alt="" fill unoptimized={!o.product.image.startsWith("/products/")} sizes="96px" className="object-cover" />
                </div>
                <div className="px-4 py-4">
                  <div className="text-[15px] font-extrabold uppercase leading-none">{o.product.name}</div>
                  <div className="tag mt-1">
                    {o.id} · {new Date(o.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="hidden px-4 py-4 md:block">
                  <div className="tag">Condition</div>
                  <div className="mt-1 text-[12px]">{o.event_title ? `${condition(o.contract_label, o.event_ticker, o.rebate_side === "no" ? "no" : "yes")} · ${o.event_title}` : "none"}</div>
                </div>
                <div className="hidden px-4 py-4 md:block">
                  <div className="tag">Paid</div>
                  <div className="num-md mt-1">{cents(o.paid_cents)}</div>
                </div>
                <div className="hidden px-4 py-4 md:block">
                  <div className="tag">Net</div>
                  <div className="num-md mt-1">{settled ? cents(triggered ? o.lose_cents! : o.paid_cents) : "–"}</div>
                </div>
                <div className={`flex items-center px-4 py-4 text-[11px] font-bold uppercase tracking-[0.1em] ${settled && triggered ? "bg-acc text-acc-fg" : ""}`}>
                  {settled ? (triggered ? `Triggered · ${cents(o.paid_cents - o.lose_cents!)} back` : o.event_title ? "No rebate" : "Complete") : o.event_title ? "Open" : "Complete"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
