import { db } from "./db";

/* Demo catalogue: Texas gameday gear. Images are inline SVG data URIs so the
   demo has zero external asset dependencies. */

export const PRODUCTS = [
  {
    id: "prd_hoodie",
    slug: "gameday-hoodie",
    name: "Gameday Hoodie",
    tagline: "Heavyweight fleece. Burnt orange.",
    description:
      "14oz brushed fleece, dropped shoulder, kangaroo pocket. The one you wear from tailgate to the fourth quarter and, if things go badly, straight to bed.",
    price_cents: 6800,
    accent: "#BF5700",
    sort: 1,
  },
  {
    id: "prd_cap",
    slug: "forty-acres-cap",
    name: "Forty Acres Cap",
    tagline: "Unstructured, six-panel, already broken in.",
    description: "Six-panel cotton twill with a brass slider. Looks like you've had it since freshman year.",
    price_cents: 3400,
    accent: "#A24A00",
    sort: 2,
  },
  {
    id: "prd_tee",
    slug: "tower-tee",
    name: "Tower Tee",
    tagline: "Ringspun cotton, boxy cut, white.",
    description: "Ringspun cotton, boxy cut, water-based ink. Glows a little under stadium lights.",
    price_cents: 3200,
    accent: "#D97B2B",
    sort: 3,
  },
  {
    id: "prd_scarf",
    slug: "stadium-scarf",
    name: "Stadium Scarf",
    tagline: "Knit stripe scarf for November nights.",
    description: "Acrylic-wool blend, double layered, fringed ends. Long enough to share.",
    price_cents: 4200,
    accent: "#8C3B00",
    sort: 4,
  },
  {
    id: "prd_tumbler",
    slug: "tailgate-tumbler",
    name: "Tailgate Tumbler",
    tagline: "30oz, insulated, dishwasher-indifferent.",
    description: "Keeps it cold through a double overtime. Powder coat with a flip lid.",
    price_cents: 2800,
    accent: "#E08A3C",
    sort: 5,
  },
  {
    id: "prd_jersey",
    slug: "throwback-jersey",
    name: "Throwback Jersey",
    tagline: "Mesh body, stitched numbers, no name on the back.",
    description: "Because the number is the name. Authentic cut, roomy enough for a hoodie underneath.",
    price_cents: 12500,
    accent: "#BF5700",
    sort: 6,
  },
];

export function seedProducts() {
  const d = db();
  const stmt = d.prepare(
    `INSERT OR REPLACE INTO products (id, slug, name, tagline, description, price_cents, image, accent, sort)
     VALUES (@id, @slug, @name, @tagline, @description, @price_cents, @image, @accent, @sort)`,
  );
  const tx = d.transaction(() => {
    for (const p of PRODUCTS) stmt.run({ ...p, image: `/products/${p.slug}.jpg` });
  });
  tx();
}

export function ensureSeeded() {
  const n = (db().prepare(`SELECT COUNT(*) c FROM products`).get() as { c: number }).c;
  if (n === 0) seedProducts();
}
