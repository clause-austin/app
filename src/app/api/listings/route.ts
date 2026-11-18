/**
 * Seller listings. Anyone with an account can put an item up; it appears in Goods next to the
 * house items and takes clauses exactly the same way. Image is an upload (stored in SQLite) or a URL.
 */
import { z } from "zod";
import { boot } from "@/lib/boot";
import { currentBuyer } from "@/lib/session";
import { db, newId, type ProductRow, type OrderRow, type HedgeRow } from "@/lib/db";
import { publish } from "@/lib/feed";
import { cents } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const MAX_IMAGE = 4 * 1024 * 1024;

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "item";
  let slug = base;
  let n = 2;
  while (db().prepare(`SELECT 1 FROM products WHERE slug=?`).get(slug)) slug = `${base}-${n++}`;
  return slug;
}

export async function POST(req: Request) {
  boot();
  const seller = await currentBuyer();
  if (!seller) return Response.json({ error: "Sign in first." }, { status: 401 });

  const form = await req.formData();
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(60),
      tagline: z.string().trim().max(90).default(""),
      description: z.string().trim().max(600).default(""),
      priceDollars: z.coerce.number().min(1).max(5000),
      imageUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
    })
    .safeParse({
      name: form.get("name"),
      tagline: form.get("tagline") ?? "",
      description: form.get("description") ?? "",
      priceDollars: form.get("price"),
      imageUrl: form.get("imageUrl") ?? "",
    });
  if (!parsed.success) return Response.json({ error: "Check the name and price. Price is in dollars, $1 to $5,000." }, { status: 400 });

  let image = parsed.data.imageUrl || "";
  const file = form.get("image");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE) return Response.json({ error: "Image must be under 4 MB." }, { status: 400 });
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return Response.json({ error: "Image must be JPEG, PNG, WebP or GIF." }, { status: 400 });
    const id = newId("img");
    db()
      .prepare(`INSERT INTO uploads (id, mime, bytes, created_at) VALUES (?, ?, ?, ?)`)
      .run(id, file.type, Buffer.from(await file.arrayBuffer()), Date.now());
    image = `/api/uploads/${id}`;
  }
  if (!image) return Response.json({ error: "Add a photo: upload one or paste an image URL." }, { status: 400 });

  const maxSort = (db().prepare(`SELECT COALESCE(MAX(sort), 0) m FROM products`).get() as { m: number }).m;
  const row: ProductRow = {
    id: newId("prd"),
    slug: slugify(parsed.data.name),
    name: parsed.data.name,
    tagline: parsed.data.tagline || `Listed by ${seller.name}`,
    description: parsed.data.description || `Sold by ${seller.name}. Pays out at list price whichever way the game goes.`,
    price_cents: Math.round(parsed.data.priceDollars * 100),
    image,
    accent: "#0a3dff",
    sort: maxSort + 1,
    seller_id: seller.id,
    created_at: Date.now(),
  };
  db()
    .prepare(
      `INSERT INTO products (id, slug, name, tagline, description, price_cents, image, accent, sort, seller_id, created_at)
       VALUES (@id, @slug, @name, @tagline, @description, @price_cents, @image, @accent, @sort, @seller_id, @created_at)`,
    )
    .run(row);
  publish({ kind: "listing", source: "system", title: `${seller.name} listed ${row.name} at ${cents(row.price_cents)}`, detail: "Takes clauses on any open Gemini market", order_id: null, href: `/p/${row.slug}` });
  return Response.json({ product: row });
}

/** The caller's listings with their sales. */
export async function GET() {
  boot();
  const seller = await currentBuyer();
  if (!seller) return Response.json({ listings: [] });
  const listings = db().prepare(`SELECT * FROM products WHERE seller_id=? ORDER BY created_at DESC`).all(seller.id) as ProductRow[];
  const out = listings.map((p) => {
    const sales = db()
      .prepare(
        `SELECT o.*, b.name as buyer_name FROM orders o JOIN buyers b ON b.id=o.buyer_id WHERE o.product_id=? ORDER BY o.created_at DESC`,
      )
      .all(p.id) as (OrderRow & { buyer_name: string })[];
    const withHedge = sales.map((o) => ({ ...o, hedge: db().prepare(`SELECT * FROM hedges WHERE order_id=? ORDER BY created_at DESC LIMIT 1`).get(o.id) as HedgeRow | undefined }));
    return { product: p, sales: withHedge };
  });
  return Response.json({ listings: out });
}

export async function DELETE(req: Request) {
  boot();
  const seller = await currentBuyer();
  if (!seller) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { id } = (await req.json()) as { id?: string };
  const p = db().prepare(`SELECT * FROM products WHERE id=? AND seller_id=?`).get(id, seller.id) as ProductRow | undefined;
  if (!p) return Response.json({ error: "Not yours." }, { status: 404 });
  const sold = (db().prepare(`SELECT COUNT(*) c FROM orders WHERE product_id=?`).get(p.id) as { c: number }).c;
  if (sold > 0) return Response.json({ error: "This item has orders against it and can't be removed." }, { status: 400 });
  db().prepare(`DELETE FROM products WHERE id=?`).run(p.id);
  return Response.json({ ok: true });
}
