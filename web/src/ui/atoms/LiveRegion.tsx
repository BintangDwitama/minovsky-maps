/**
 * Visually hidden polite live region: screen readers speak its text when it changes. Atomic, so a
 * new message replaces a pending one rather than queueing behind it.
 */
export function LiveRegion({ text }: { text: string }) {
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="announcer">
      {text}
    </div>
  );
}
