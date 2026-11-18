"use client";

import Link from "next/link";
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

  if (loading) return <div className="label px-4 py-24 text-center">Loading</div>;
  if (!buyer)
    return (
      <div className="mx-auto max-w-xl px-4 py-24">
        <div className="label">Orders</div>
        <div className="serif mt-3 text-[40px] leading-tight">Sign in to see your instruments.</div>
        <p className="mt-3 text-ink-3">The link is in the top right. It only asks for a name.</p>
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6">
      <div className="label">Orders · {buyer.name}</div>
      <h1 className="serif mt-2 text-[44px] leading-none">Your instruments</h1>
      <p className="mt-3 max-w-[50ch] text-[13.5px] text-ink-2">Clauses settle themselves. Come back after the game, or don&apos;t. The money finds you.</p>

      <div className="mt-10 overflow-x-auto">
        {orders === null && <div className="label">Loading</div>}
        {orders?.length === 0 && (
          <div className="border border-dashed border-line p-10 text-center text-ink-3">
            Nothing yet.{" "}
            <Link href="/" className="link text-ink">
              Draft one.
            </Link>
          </div>
        )}
        {orders && orders.length > 0 && (
          <table className="ledger min-w-[620px]">
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Goods</th>
                <th>Condition</th>
                <th className="r">Paid</th>
                <th className="r">Net</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const settled = o.status === "settled" || o.status === "rebated";
                const triggered = o.outcome === "rebate";
                return (
                  <tr key={o.id} className="group relative hover:bg-paper-2/70">
                    <td className="mono text-[11.5px]">
                      <Link href={`/orders/${o.id}`} className="after:absolute after:inset-0">
                        {o.id}
                      </Link>
                      <div className="text-ink-3">{new Date(o.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="serif text-[19px] leading-none">{o.product.name}</td>
                    <td className="max-w-[240px] text-[12.5px]">
                      {o.event_title ? (
                        <>
                          <div>
                            {o.contract_label} {o.rebate_side === "no" ? "lose" : "win"}
                          </div>
                          <div className="truncate text-ink-3">{o.event_title}</div>
                        </>
                      ) : (
                        <span className="text-ink-3">none</span>
                      )}
                    </td>
                    <td className="num r">{cents(o.paid_cents)}</td>
                    <td className="num r">{settled ? cents(triggered ? o.lose_cents! : o.paid_cents) : <span className="text-ink-3">pending</span>}</td>
                    <td className="mono text-[11px]">
                      {settled ? (
                        triggered ? (
                          <span className="text-red">satisfied · {cents(o.paid_cents - o.lose_cents!)} returned</span>
                        ) : (
                          "discharged"
                        )
                      ) : o.event_title ? (
                        <span className="text-ink-3">awaiting result</span>
                      ) : (
                        "complete"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
