"use client";

import type { FeedRow } from "@/lib/db";

export function FeedList({ rows, compact = false }: { rows: FeedRow[]; compact?: boolean }) {
  if (rows.length === 0) return <div className="tag px-4 py-6 text-center">Nothing yet</div>;
  return (
    <ul>
      {[...rows].reverse().map((r) => (
        <li key={r.id} className={`grid grid-cols-[72px_84px_1fr] gap-3 border-b border-fg px-4 last:border-b-0 ${compact ? "py-2" : "py-3"}`}>
          <span className="text-[11px] text-mute">{new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          <span className="text-[11px] font-bold uppercase tracking-[0.08em]">{r.source === "system" ? "clause" : r.source}</span>
          <div className="min-w-0">
            <div className="truncate text-[12px]">{r.title}</div>
            {r.detail && <div className="truncate text-[11px] text-mute">{r.detail}</div>}
            {r.href && (
              <a href={r.href} target="_blank" rel="noreferrer" className="text-[10px] font-bold uppercase tracking-[0.1em] text-acc hover:underline">
                {r.href.includes("gemini") ? "gemini" : "explorer"} ↗
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
