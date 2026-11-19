import Link from "next/link";

export const metadata = { title: "CLAUSE — Demo" };

export default function DemoVideo() {
  return (
    <div>
      <div className="flex items-center justify-between border-b border-fg">
        <span className="tag px-4 py-2">Demo · 1:54 · UBC 2026</span>
        <Link href="/" className="inv px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em]">
          Open the store →
        </Link>
      </div>
      <div className="bg-fg">
        <video controls playsInline preload="metadata" className="mx-auto block max-h-[calc(100vh-49px-140px)] w-full" src="/video/demo.mp4" />
      </div>
      <div className="grid-lines grid-cols-1 border-t border-fg md:grid-cols-3">
        <div className="cell px-4 py-4">
          <div className="tag">What you&apos;re watching</div>
          <p className="mt-2 text-[12px] leading-relaxed text-mute">A real run against this site. The hoodie clause is hedged at live Gemini prices and settled in USDC on Solana devnet; the tumbler clause places a real order on Gemini&apos;s sandbox exchange.</p>
        </div>
        <div className="cell px-4 py-4">
          <div className="tag">Try it yourself</div>
          <p className="mt-2 text-[12px] leading-relaxed text-mute">Sign in with any name and a passcode, add funds, pick a game or a crypto window, and buy. Crypto windows resolve within the hour on their own.</p>
        </div>
        <div className="cell px-4 py-4">
          <div className="tag">Direct file</div>
          <a href="/video/demo.mp4" className="mt-2 inline-block text-[12px] font-bold uppercase tracking-[0.1em] text-acc hover:underline">
            demo.mp4 ↗
          </a>
        </div>
      </div>
    </div>
  );
}
