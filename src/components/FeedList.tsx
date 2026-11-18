"use client";

import type { FeedRow } from "@/lib/db";

const SOURCE: Record<FeedRow["source"], string> = {
  solana: "solana",
  gemini: "gemini",
  quicknode: "quicknode",
  elevenlabs: "elevenlabs",
  system: "clause",
};

export function FeedList({ rows, compact = false }: { rows: FeedRow[]; compact?: boolean }) {
  if (rows.length === 0) return <div className="label py-6 text-center">Nothing yet</div>;
  return (
    <ul>
      {[...rows].reverse().map((r) => (
        <li key={r.id} className={`grid grid-cols-[74px_92px_1fr] gap-3 border-b border-line-2 last:border-b-0 ${compact ? "py-2" : "py-3"}`}>
          <span className="mono text-[11px] text-ink-3">{new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          <span className="mono text-[11px] text-ink-3">{SOURCE[r.source] ?? "clause"}</span>
          <div className="min-w-0">
            <div className="truncate text-[12.5px]">{r.title}</div>
            {r.detail && <div className="truncate text-[11.5px] text-ink-3">{r.detail}</div>}
            {r.href && (
              <a href={r.href} target="_blank" rel="noreferrer" className="label !text-red hover:underline underline-offset-4">
                explorer ↗
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
