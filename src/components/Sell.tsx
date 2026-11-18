"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductRow, OrderRow, HedgeRow } from "@/lib/db";
import { cents } from "@/lib/pricing";
import { useBuyer } from "./buyer";
import { SignInInline } from "./SignInInline";

type Listing = { product: ProductRow; sales: (OrderRow & { buyer_name: string; hedge?: HedgeRow })[] };

export function Sell() {
  const router = useRouter();
  const { buyer, loading } = useBuyer();
  const [listings, setListings] = useState<Listing[] | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/listings", { cache: "no-store" });
    setListings(((await r.json()) as { listings: Listing[] }).listings);
  }, []);
  useEffect(() => {
    if (buyer) load();
  }, [buyer, load]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/listings", { method: "POST", body: new FormData(e.currentTarget) });
      const j = (await r.json()) as { product?: ProductRow; error?: string };
      if (!r.ok || !j.product) throw new Error(j.error ?? "Could not list that.");
      router.push(`/p/${j.product.slug}`);
    } catch (er) {
      setErr((er as Error).message);
      setBusy(false);
    }
  }

  if (loading) return <div className="tag px-4 py-24 text-center">Loading</div>;

  return (
    <div>
      <div className="grid-lines grid-cols-[1fr_auto] border-b border-fg">
        <div className="cell flex items-baseline gap-4 px-4 py-3">
          <span className="h-md">Sell</span>
          <span className="tag">Put anything up. It takes clauses like everything else.</span>
        </div>
        <div className="cell tag flex items-center px-4">You get list price either way</div>
      </div>

      <div className="grid-lines grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
        <div className="cell">
          {!buyer ? (
            <div>
              <div className="tag border-b border-fg px-4 py-2">Sign in to list</div>
              <SignInInline />
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col">
              <div className="tag border-b border-fg px-4 pt-3 pb-1">01 · What is it</div>
              <input name="name" required minLength={2} maxLength={60} placeholder="Item name" className="field border-b border-fg" />
              <input name="tagline" maxLength={90} placeholder="One line about it (optional)" className="field border-b border-fg !font-normal !normal-case" />
              <textarea name="description" maxLength={600} rows={3} placeholder="Longer description (optional)" className="field border-b border-fg !font-normal !normal-case" style={{ resize: "none" }} />
              <div className="grid-lines grid-cols-2 border-b border-fg">
                <div className="cell">
                  <div className="tag px-4 pt-3">02 · List price, USD</div>
                  <input name="price" type="number" required min={1} max={5000} step="0.01" placeholder="68.00" className="field num-md !py-3" />
                </div>
                <div className="cell px-4 py-3 text-[11px] leading-relaxed text-mute">
                  Buyers can attach a clause to any open Gemini market. Clause hedges it. You are paid the list price in USDC whichever way the game goes.
                </div>
              </div>
              <div className="tag border-b border-fg px-4 pt-3 pb-1">03 · Photo</div>
              <div className="grid-lines grid-cols-1 border-b border-fg sm:grid-cols-[1fr_1fr]">
                <label className="cell inv flex cursor-pointer items-center justify-between px-4 py-4 text-[12px] font-bold uppercase">
                  <span>{preview ? "Change photo" : "Upload a photo"}</span>
                  <span>↑</span>
                  <input
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setPreview(f ? URL.createObjectURL(f) : null);
                    }}
                  />
                </label>
                <input name="imageUrl" type="url" placeholder="or paste an image URL" className="field cell !font-normal !normal-case" />
              </div>
              {preview && (
                <div className="relative aspect-[4/5] max-h-[320px] border-b border-fg bg-faint">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="" className="photo" />
                </div>
              )}
              {err && <div className="border-b border-fg px-4 py-3 text-[12px] font-bold text-acc">{err}</div>}
              <button disabled={busy} className="btn">
                <span>{busy ? "Listing" : "List it"}</span>
                <span>→</span>
              </button>
            </form>
          )}
        </div>

        <div className="cell">
          <div className="tag border-b border-fg px-4 py-2">Your listings</div>
          {!buyer && <div className="px-4 py-8 text-mute">Sign in to see them.</div>}
          {buyer && listings === null && <div className="tag px-4 py-8">Loading</div>}
          {buyer && listings?.length === 0 && <div className="px-4 py-8 text-mute">Nothing listed yet.</div>}
          {listings?.map(({ product: p, sales }) => {
            const settled = sales.filter((s) => s.status === "settled" || s.status === "rebated");
            const paidOut = settled.reduce((a, s) => a + s.base_cents, 0);
            const open = sales.length - settled.length;
            return (
              <div key={p.id} className="border-b border-fg">
                <div className="grid grid-cols-[72px_1fr_auto]">
                  <div className="relative border-r border-fg bg-faint">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image} alt="" className="photo absolute inset-0" />
                  </div>
                  <Link href={`/p/${p.slug}`} className="inv px-4 py-3">
                    <div className="text-[14px] font-extrabold uppercase leading-none">{p.name}</div>
                    <div className="tag mt-1">
                      {cents(p.price_cents)} · {sales.length} sold · {open} open
                    </div>
                  </Link>
                  <div className="px-4 py-3 text-right">
                    <div className="tag">Paid to you</div>
                    <div className="num-md mt-1">{cents(paidOut)}</div>
                  </div>
                </div>
                {sales.length > 0 && (
                  <ul className="border-t border-fg text-[11.5px]">
                    {sales.map((s) => (
                      <li key={s.id} className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-fg/20 px-4 py-2 last:border-b-0">
                        <span className="truncate">
                          <b>{s.buyer_name}</b> {s.event_title ? `· ${s.contract_label} ${s.rebate_side === "no" ? "lose" : "win"}` : "· no clause"}
                        </span>
                        <span className="text-mute">{s.status === "rebated" ? "triggered" : s.status === "settled" ? "settled" : "open"}</span>
                        <span className="font-bold">{s.status === "settled" || s.status === "rebated" ? cents(s.base_cents) : `${cents(s.base_cents)} locked`}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
