/**
 * Original Minovsky Maps mark: a flat-top hex plate with a cut-in vent and a centre stud.
 * Decorative; the brand name is always shown as text next to it.
 */
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden className="flex-none">
      <polygon points="11,0 5.5,9.5 -5.5,9.5 -11,0 -5.5,-9.5 5.5,-9.5" fill="var(--frame-ink)" />
      <polygon points="-5.5,-9.5 5.5,-9.5 3.5,-6 -3.5,-6" fill="var(--vent)" />
      <polygon
        points="7,0 3.5,6 -3.5,6 -7,0 -3.5,-6 3.5,-6"
        fill="none"
        stroke="var(--frame)"
        strokeWidth="1"
        opacity="0.35"
      />
      <circle r="2.6" fill="var(--frame)" />
    </svg>
  );
}
