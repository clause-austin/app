import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { boot } from "@/lib/boot";
import { getProduct, getBuyer } from "@/lib/orders";
import { featuredEvents, type GeminiEvent } from "@/lib/gemini/public";
import { cents } from "@/lib/pricing";
import { ClauseBuilder } from "@/components/ClauseBuilder";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  boot();
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();
  const seller = product.seller_id ? getBuyer(product.seller_id) : undefined;
  let events: GeminiEvent[] = [];
  try {
    events = await featuredEvents();
  } catch {
    events = [];
  }

  return (
    <div className="grid-lines grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
      <div className="cell"><div className="lg:sticky lg:top-[49px]">
        <div className="flex items-center justify-between border-b border-fg">
          <Link href="/" className="inv px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em]">
            ← Goods
          </Link>
          <span className="tag px-4">{seller ? `Listed by ${seller.name}` : "House item"}</span>
        </div>
        <div className="relative aspect-[4/5] bg-faint lg:aspect-auto lg:h-[calc(100vh-49px-170px)]">
          <Image src={product.image} alt={product.name} fill priority unoptimized={!product.image.startsWith("/products/")} sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" />
        </div>
        <div className="grid-lines grid-cols-[1fr_auto] border-t border-fg">
          <div className="cell px-4 py-4">
            <div className="h-md">{product.name}</div>
            <div className="tag mt-1">{product.tagline}</div>
            <p className="mt-3 max-w-[48ch] text-[12px] leading-relaxed text-mute">{product.description}</p>
          </div>
          <div className="cell flex flex-col justify-between px-4 py-4 text-right">
            <div className="tag">List</div>
            <div className="num-lg">{cents(product.price_cents)}</div>
          </div>
        </div>
      </div>
      </div>
      <div className="cell">
        <ClauseBuilder product={{ slug: product.slug, name: product.name, priceCents: product.price_cents }} events={events} />
      </div>
    </div>
  );
}
