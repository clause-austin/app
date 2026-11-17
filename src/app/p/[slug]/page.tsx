import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { boot } from "@/lib/boot";
import { getProduct } from "@/lib/orders";
import { featuredEvents, type GeminiEvent } from "@/lib/gemini/public";
import { cents } from "@/lib/pricing";
import { ClauseBuilder } from "@/components/ClauseBuilder";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  boot();
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();
  let events: GeminiEvent[] = [];
  try {
    events = await featuredEvents();
  } catch {
    events = [];
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/" className="text-sm text-ink-3 hover:text-ink">
        ← Back to the shop
      </Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="overflow-hidden rounded-3xl border border-line bg-paper">
            <Image src={product.image} alt={product.name} width={800} height={800} priority className="w-full" />
          </div>
          <div className="mt-6">
            <h1 className="font-display text-4xl font-semibold">{product.name}</h1>
            <p className="mt-1 text-ink-3">{product.tagline}</p>
            <p className="mt-4 max-w-prose leading-relaxed text-ink-2">{product.description}</p>
            <div className="mt-6 flex items-baseline gap-3">
              <span className="text-xs uppercase tracking-widest text-ink-3">Sticker price</span>
              <span className="scoreboard text-3xl font-semibold">{cents(product.price_cents)}</span>
            </div>
          </div>
        </div>
        <ClauseBuilder product={{ slug: product.slug, name: product.name, priceCents: product.price_cents }} events={events} />
      </div>
    </div>
  );
}
