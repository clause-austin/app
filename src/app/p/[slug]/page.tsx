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
    <div className="mx-auto max-w-6xl px-4 md:px-6">
      <div className="grid md:grid-cols-[1fr_1.35fr]">
        <div className="py-10 md:sticky md:top-[57px] md:self-start md:py-14 md:pr-12">
          <Link href="/" className="label hover:!text-ink">
            ← Schedule A
          </Link>
          <div className="group mt-8 border border-line bg-paper-2/40 p-6">
            <Image src={product.image} alt={product.name} width={800} height={800} priority className="art w-full" />
          </div>
          <div className="mt-8 flex items-baseline justify-between gap-6">
            <h1 className="serif text-[40px] leading-none">{product.name}</h1>
            <div className="num text-[22px]">{cents(product.price_cents)}</div>
          </div>
          <p className="mt-2 text-[13px] text-ink-3">{product.tagline}</p>
          <p className="mt-5 max-w-[46ch] text-[13.5px] leading-relaxed text-ink-2">{product.description}</p>
        </div>
        <div className="border-t border-line py-10 md:border-t-0 md:border-l md:py-14 md:pl-12">
          <ClauseBuilder product={{ slug: product.slug, name: product.name, priceCents: product.price_cents }} events={events} />
        </div>
      </div>
    </div>
  );
}
