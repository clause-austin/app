/** The Clause mark: a bracket-C with the blue strike that runs through every struck price. */
export function Mark({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} className={className} aria-hidden="true">
      <rect width="256" height="256" fill="currentColor" />
      <path d="M200 56H56v144h144v-28H84V84h116z" fill="var(--bg)" />
      <rect x="112" y="114" width="144" height="28" fill="var(--acc)" />
    </svg>
  );
}
