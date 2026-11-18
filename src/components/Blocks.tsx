/** 24-segment block bar. `fill` 0..1. Optional `acc` colours the filled part accent instead of black. */
export function Blocks({ fill, acc = false, className = "" }: { fill: number; acc?: boolean; className?: string }) {
  const n = Math.round(Math.min(1, Math.max(0, fill)) * 24);
  return (
    <span className={`blocks ${className}`} aria-hidden>
      {Array.from({ length: 24 }, (_, i) => (
        <i key={i} className={i < n ? (acc ? "acc" : "on") : ""} />
      ))}
    </span>
  );
}
