"use client";

import { useEffect, useState } from "react";
import type { FeedRow } from "@/lib/db";

export function useFeed(orderId?: string, onEvent?: (row: FeedRow) => void) {
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const es = new EventSource(`/api/stream${orderId ? `?order=${encodeURIComponent(orderId)}` : ""}`);
    es.addEventListener("hello", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { backlog: FeedRow[] };
      setRows(d.backlog);
      setConnected(true);
    });
    es.addEventListener("feed", (e) => {
      const row = JSON.parse((e as MessageEvent).data) as FeedRow;
      setRows((r) => [...r, row]);
      onEvent?.(row);
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);
  return { rows, connected };
}
