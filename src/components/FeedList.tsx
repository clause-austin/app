"use client";

import type { FeedRow } from "@/lib/db";

const SOURCE: Record<FeedRow["source"], { label: string; cls: string }> = {
  solana: { label: "Solana", cls: "bg-[#e9e3f7] text-[#4b2fa3]" },
  gemini: { label: "Gemini", cls: "bg-[#dcebf7] text-[#1b4f8a]" },
  quicknode: { label: "QuickNode", cls: "bg-[#e3f3ea] text-[#1f6b3f]" },
  elevenlabs: { label: "ElevenLabs", cls: "bg-ink text-cream" },
  system: { label: "Store", cls: "bg-cream-2 text-ink-2" },
};

export function FeedList({ rows, compact = false }: { rows: FeedRow[]; compact?: boolean }) {
  if (rows.length === 0) return <div className="py-6 text-center text-sm text-ink-3">Quiet for now.</div>;
  return (
    <ul className="divide-y divide-line/70">
      {[...rows].reverse().map((r) => {
        const s = SOURCE[r.source] ?? SOURCE.system;
        return (
          <li key={r.id} className={`flex gap-3 ${compact ? "py-2.5" : "py-3"}`}>
            <span className={`mt-0.5 h-fit shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.cls}`}>{s.label}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{r.title}</div>
              {r.detail && <div className="truncate text-xs text-ink-3">{r.detail}</div>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="tabular text-[11px] text-ink-3">{new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              {r.href && (
                <a href={r.href} target="_blank" rel="noreferrer" className="text-[11px] text-orange underline-offset-2 hover:underline">
                  view ↗
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
