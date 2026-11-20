"use client";

import { useEffect, useRef, useState } from "react";

const CUES: { t: number; scene: string; line: string }[] = [
  { t: 0, scene: "Title card", line: "This is Clause. Pay less if they lose." },
  { t: 3, scene: "Home, goods grid", line: "A store where any price can carry a condition. The odds come from Gemini's prediction markets, the money settles in USDC on Solana, and nobody has to know that." },
  { t: 7, scene: "Sell page: Maya lists the ball", line: "Anyone can sell. Maya lists a signed game ball at a hundred and fifty dollars. She gets list price whichever way the game goes. That's the deal for sellers." },
  { t: 28, scene: "Buyer opens the listing", line: "Kevin wants it, and he believes in Texas." },
  { t: 30, scene: "Slider", line: "He picks what he'd rather have paid if Texas loses. The price today moves with it. Every number comes from a live order book, and the store hedges the difference the moment he pays." },
  { t: 35, scene: "Name, passcode, Buy", line: "A name and a passcode. No wallet, no seed phrase. The payment goes into escrow as USDC." },
  { t: 43, scene: "Receipt: waiting", line: "The receipt shows the hedge already placed and when the market resolves. Nothing to do at the end of the game." },
  { t: 46, scene: "Ledger, Texas loses", line: "This is the store's side: every order, what it nets either way, and a resolution desk. For the demo, we call it. Texas loses." },
  { t: 55, scene: "Receipt: triggered", line: "Seconds later it's on chain. A hundred and fourteen dollars back to Kevin, and ElevenLabs reads the result out loud. Every step links to the Solana explorer." },
  { t: 61, scene: "Maya paid $150", line: "And Maya? Paid in full. A hundred and fifty, list price, even though the buyer paid forty-eight." },
  { t: 73, scene: "Tumbler, Solana window", line: "It isn't only sports. Pay less on this tumbler if Solana is up in the next fifteen minutes." },
  { t: 86, scene: "Crypto receipt, Gemini order ID", line: "That hedge is a real order on Gemini's exchange, order ID on the receipt, and it settles from Gemini's own resolution when the window closes." },
  { t: 92, scene: "How page", line: "A store can't take a bet on every hoodie. A market can. That's Clause." },
];

export default function Prompter() {
  const v = useRef<HTMLVideoElement>(null);
  const [t, setT] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const el = v.current;
    if (!el) return;
    const f = () => setT(el.currentTime);
    el.addEventListener("timeupdate", f);
    return () => el.removeEventListener("timeupdate", f);
  }, []);
  const idx = CUES.reduce((a, c, i) => (t >= c.t - 0.2 ? i : a), 0);
  const cur = CUES[idx];
  const next = CUES[idx + 1];
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  async function start() {
    const el = v.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    for (let n = 3; n > 0; n--) {
      setCount(n);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setCount(null);
    await el.play();
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-fg">
        <span className="tag px-4 py-2">Teleprompter · start your recorder, then press Go</span>
        <button onClick={start} className="inv px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em]">
          Go (3-second count-in) →
        </button>
      </div>
      <div className="grid-lines grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
        <div className="cell relative bg-fg">
          <video ref={v} playsInline preload="auto" className="block w-full" src="/video/demo.mp4" />
          {count !== null && <div className="absolute inset-0 flex items-center justify-center bg-bg/90 text-[200px] font-extrabold">{count}</div>}
        </div>
        <div className="cell flex flex-col">
          <div className="flex justify-between border-b border-fg px-4 py-2">
            <span className="tag">{fmt(t)} · {cur.scene}</span>
            <span className="tag">cue {fmt(cur.t)}</span>
          </div>
          <div className="px-4 py-6 text-[26px] font-bold leading-snug">{cur.line}</div>
          {next && (
            <div className="mt-auto border-t border-fg px-4 py-4">
              <div className="tag">Next · {fmt(next.t)} · {next.scene}</div>
              <div className="mt-1 text-[14px] leading-relaxed text-mute">{next.line}</div>
            </div>
          )}
        </div>
      </div>
      <div className="grid-lines grid-cols-1 border-t border-fg md:grid-cols-3">
        <div className="cell px-4 py-4 text-[12px] leading-relaxed text-mute"><b className="text-fg">1.</b> Open QuickTime Player, File, New Audio Recording. Pick your mic. Press its record button.</div>
        <div className="cell px-4 py-4 text-[12px] leading-relaxed text-mute"><b className="text-fg">2.</b> Press Go here. Read each line when it appears. The video is muted, so only your voice is captured.</div>
        <div className="cell px-4 py-4 text-[12px] leading-relaxed text-mute"><b className="text-fg">3.</b> Stop the recording, save the .m4a, and send it over. It gets muxed onto the video with the start aligned to the count-in.</div>
      </div>
    </div>
  );
}
